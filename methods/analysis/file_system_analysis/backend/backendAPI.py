import datetime
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from elasticsearch import Elasticsearch
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from functools import wraps
import jwt
import json
import subprocess
import fsa_lib as fsa

es = Elasticsearch()
app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = '/tmp'
app.config['SECRET_KEY'] = os.urandom(128)
app.config['elastic_metadata_index'] = 'metadata'
app.config['elastic_metadata_type'] = None
app.config['elastic_filter_index'] = 'filter'
app.config['elastic_filter_type'] = None
app.config['elastic_user_index'] = 'user'
app.config['elastic_user_type'] = None
app.config['TOKEN_EXPIRATION'] = datetime.timedelta(minutes=30)


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'])
            current_user = data['username'], data['groups']
        except:
            return jsonify({'message': 'Token is invalid!'}), 401

        return f(current_user, *args, **kwargs)

    return decorated


@app.route('/login', methods=['POST'])
def login():
    if not request.get_json() or not request.get_json()['username'] or not request.get_json()['password']:
        return jsonify({'message': 'Wrong username or password'}), 400
    body = {'query': {'term': {'username': request.get_json()['username']}}}
    res = es.search(index=app.config['elastic_user_index'], doc_type=app.config['elastic_user_type'], body=body)
    for user in res['hits']['hits']:
        username = user['_source']['username']
        password = user['_source']['password']
        groups = user['_source']['groups']
        if request.get_json()['username'] == username:
            if check_password_hash(password, request.get_json()['password']):
                token = jwt.encode(
                    {'username': username,
                     'groups': groups,
                     'exp': datetime.datetime.utcnow() + app.config['TOKEN_EXPIRATION']},
                    app.config['SECRET_KEY'])
                return jsonify({'token': token.decode('UTF-8')})
    return jsonify({'message': 'Wrong username or password'}), 400


@app.route('/')
def es_info():
    return jsonify(es.info())


@app.route('/upload', methods=['POST'])
@token_required
def upload(current_user):
    if 'admin' not in current_user[1]:
        return jsonify({'message': 'Not authorized'}), 403
    if 'case' not in request.form:
        return jsonify({'status': 'failed', 'message': 'Case name is missing in form'})
    else:
        case = request.form['case']
    print(case)
    if 'file' not in request.files:
        return jsonify({'status': 'failed', 'message': 'No file to upload'})
    for file in request.files.getlist('file'):
        print(file)
        if file.filename == '':
            return jsonify({'status': 'failed', 'message': 'Invalid file name'})
        if file:
            filename = secure_filename(file.filename)
            sys_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(sys_path)
            subprocess.Popen(['python3', './metadata-uploader.py', '-c', case, '-f', sys_path, '-ds', 'true'])
    return jsonify({'status': 'OK', 'message': 'uploading files'})


@app.route('/search', methods=['POST'])
@token_required
def search(current_user):
    print(request.form)
    print(request.get_json())
    es_index = request.form['index']
    es_type = request.form['type']
    query = json.loads(request.form['query'])
    print(query, es_index, es_type)

    if not es_index or not query:
        return jsonify({'message': 'Wrong parameters'}), 404
    res = es.search(index=es_index, doc_type=es_type, body=query)
    return jsonify(res)


@app.route('/case/all', methods=['GET'])
@token_required
def cases(current_user):
    query = {
        'aggs': {
            'cases': {
                'terms': {
                    'field': 'case.keyword',
                    'size': 2147483647
                }
            }
        }
    }

    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=query)
    return jsonify(cases=res['aggregations']['cases']['buckets'])


@app.route('/filter/all', methods=['GET'])
@token_required
def filters(current_user):
    query = {
            'aggs': {
                'filters': {
                    'terms': {
                        'field': 'name.keyword',
                        'size': 2147483647
                    }
                }
            }
    }

    res = es.search(index=app.config['elastic_filter_index'], doc_type=app.config['elastic_filter_type'], body=query)
    return jsonify(res)


@app.route('/filter/name', methods=['POST'])
@token_required
def filter_by_name(current_user):
    if 'name' not in request.json:
        return jsonify({'message': 'Bad request'}), 400
    else:
        filter_name = request.json.get('name')
    query = {
            'query': {
                'term': {
                    'name.keyword': {
                        'value': filter_name
                    }
                }
            }
    }

    res = es.search(index=app.config['elastic_filter_index'], doc_type=app.config['elastic_filter_type'], body=query)
    return jsonify(res)


@app.route('/clusters/data/<string:case>', methods=['POST'])
@token_required
def clusters_get_data(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')
    begin = request.json.get('begin')
    page_size = request.json.get('page_size')
    sort = request.json.get('sort')
    sort_order = request.json.get('sort_order')

    query = fsa.build_data_query(case, clusters, additional_filters, begin, page_size, sort, sort_order)
    print(json.dumps(query))
    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(query))
    return jsonify(res)


@app.route('/clusters/entries_border/<string:case>', methods=['POST'])
@token_required
def clusters_entries_border(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')
    border = request.json.get('border')

    query = fsa.build_number_of_entries_query(case, clusters, additional_filters, border)
    print('border', json.dumps(query))
    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(query))
    return jsonify(res)


@app.route('/cluster/count/<string:case>', methods=['POST'])
@token_required
def cluster_get_count(current_user, case):
    cluster = request.json.get('cluster')
    additional_filters = request.json.get('additional_filters')

    query = fsa.build_count_query(case, cluster, additional_filters)
    print(json.dumps(query))
    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(query))
    return jsonify(res)


@app.route('/cluster/first_and_last/<string:case>', methods=['POST'])
@token_required
def cluster_get_first_and_last_entry(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')
    mac_type = request.json.get('mac_type')

    first_query = fsa.build_first_entry_query(case, clusters, additional_filters, mac_type, 'asc')
    last_query = fsa.build_first_entry_query(case, clusters, additional_filters, mac_type, 'desc')
    print(json.dumps(first_query))
    first = es.search(index=app.config['elastic_metadata_index'],
                      doc_type=app.config['elastic_metadata_type'],
                      body=json.dumps(first_query))
    last = es.search(index=app.config['elastic_metadata_index'],
                     doc_type=app.config['elastic_metadata_type'],
                     body=json.dumps(last_query))
    res = []
    if first is not None:
        print(first)
        res.append(first['hits']['hits'][0])
    if last is not None:
        res.append(last['hits']['hits'][0])
    return jsonify(res)


@app.route('/graph/data/<string:case>', methods=['POST'])
@token_required
def graph_get_data(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')
    mac_type = request.json.get('mac_type')
    frequency = request.json.get('frequency')
    if frequency is None:
        frequency = 'day'

    query = fsa.build_graph_data_query(case, clusters, additional_filters, mac_type, frequency)
    print(json.dumps(query))
    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(query))
    return jsonify(res)


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
