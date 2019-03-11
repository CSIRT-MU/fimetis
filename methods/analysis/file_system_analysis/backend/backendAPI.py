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
app.config['SECRET_KEY'] = 'thisissecretkey'
app.config['elastic_metadata_index'] = 'metadata'
app.config['elastic_metadata_type'] = ''
app.config['elastic_filter_index'] = 'filter'
app.config['elastic_filter_type'] = ''


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
            current_user = data['username']
        except:
            return jsonify({'message': 'Token is invalid!'}), 401

        return f(current_user, *args, **kwargs)

    return decorated


@app.route('/login', methods=['POST'])
def login():
    auth = request.authorization
    username = 'admin'
    password = 'timesix'

    # if not auth or not auth.username or not auth.password:
    #     print('bad', request.get_json(force=True)['username'])
    #     return make_response('Could not verify', 401, {'WWW-Authenticate': 'Basic realm="Login required!"'})

    if not request.get_json() or not request.get_json()['username'] or not request.get_json()['password']:
        return jsonify({'message': 'Wrong username or password'}), 400
        # return make_response('Could not verify', 403, {'WWW-Authenticate': 'Basic realm="Login required!"'})

    # user = User.query.filter_by(name=auth.username).first()

    if request.get_json()['username'] != username:
        print('user unknown')
        return jsonify({'message': 'Wrong username or password'}), 400
        # return make_response('Could not verify', 403, {'WWW-Authenticate': 'Basic realm="Login required!"'})

    if check_password_hash(generate_password_hash(password, method='sha256'), request.get_json()['password']):
        token = jwt.encode(
            {'username': username, 'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=30)},
            app.config['SECRET_KEY'])

        return jsonify({'token': token.decode('UTF-8')})
    return jsonify({'message': 'Wrong username or password'}), 400
    # return make_response('Could not verify', 403, {'WWW-Authenticate': 'Basic realm="Login required!"'})


@app.route('/')
def es_info():
    return jsonify(es.info())


@app.route('/upload', methods=['POST'])
@token_required
def upload(current_user):
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
    if not es_type:
        res = es.search(index=es_index, body=query)
    else:
        res = es.search(index=es_index, type=es_type, body=query)
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

    if not app.config['elastic_metadata_type']:
        res = es.search(index=app.config['elastic_metadata_index'], body=query)
    else:
        res = es.search(index=app.config['elastic_metadata_index'],
                        type=app.config['elastic_metadata_type'],
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

    if not app.config['elastic_filter_type']:
        res = es.search(index=app.config['elastic_filter_index'], body=query)
    else:
        res = es.search(index=app.config['elastic_filter_index'], type=app.config['elastic_filter_type'], body=query)
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

    if not app.config['elastic_filter_type']:
        res = es.search(index=app.config['elastic_filter_index'], body=query)
    else:
        res = es.search(index=app.config['elastic_filter_index'], type=app.config['elastic_filter_type'], body=query)
    return jsonify(res)


@app.route('/clusters/data/<string:case>', methods=['POST'])
@token_required
def clusters_get_data(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')
    graph_filter = request.json.get('graph_filter')
    begin = request.json.get('begin')
    page_size = request.json.get('page_size')
    sort = request.json.get('sort')
    sort_order = request.json.get('sort_order')

    query = fsa.build_data_query(case, clusters, additional_filters, graph_filter, begin, page_size, sort, sort_order)
    print(json.dumps(query))
    if not app.config['elastic_metadata_type']:
        res = es.search(index=app.config['elastic_metadata_index'],
                        body=json.dumps(query))
    else:
        res = es.search(index=app.config['elastic_metadata_index'],
                        type=app.config['elastic_metadata_type'],
                        body=json.dumps(query))
    return jsonify(res)


@app.route('/clusters/entries_border/<string:case>', methods=['POST'])
@token_required
def clusters_entries_border(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')
    border = request.json.get('border')

    query = fsa.build_number_of_entries_query(case, clusters, additional_filters, border)
    print(json.dumps(query))
    if not app.config['elastic_metadata_type']:
        res = es.search(index=app.config['elastic_metadata_index'],
                        body=json.dumps(query))
    else:
        res = es.search(index=app.config['elastic_metadata_index'],
                        type=app.config['elastic_metadata_type'],
                        body=json.dumps(query))
    return jsonify(res)


@app.route('/cluster/count/<string:case>', methods=['POST'])
@token_required
def cluster_get_count(current_user, case):
    cluster = request.json.get('cluster')
    additional_filters = request.json.get('additional_filters')

    query = fsa.build_count_query(case, cluster, additional_filters)
    print(json.dumps(query))
    if not app.config['elastic_metadata_type']:
        res = es.search(index=app.config['elastic_metadata_index'],
                        body=json.dumps(query))
    else:
        res = es.search(index=app.config['elastic_metadata_index'],
                        type=app.config['elastic_metadata_type'],
                        body=json.dumps(query))
    return jsonify(res)


@app.route('/cluster/first_and_last/<string:case>', methods=['POST'])
@token_required
def cluster_get_first_and_last_entry(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')
    mac_type = request.json.get('mac_type')

    first_query = fsa.build_first_or_last_query(case, clusters, additional_filters, mac_type, 'asc')
    last_query = fsa.build_first_or_last_query(case, clusters, additional_filters, mac_type, 'desc')
    print(json.dumps(first_query))
    if not app.config['elastic_metadata_type']:
        first = es.search(index=app.config['elastic_metadata_index'],
                          body=json.dumps(first_query))
        last = es.search(index=app.config['elastic_metadata_index'],
                         body=json.dumps(last_query))
    else:
        first = es.search(index=app.config['elastic_metadata_index'],
                          type=app.config['elastic_metadata_type'],
                          body=json.dumps(first_query))
        last = es.search(index=app.config['elastic_metadata_index'],
                         type=app.config['elastic_metadata_type'],
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

    query = fsa.build_graph_data_query(case, clusters, additional_filters, mac_type, frequency)
    print(json.dumps(query))
    if not app.config['elastic_metadata_type']:
        res = es.search(index=app.config['elastic_metadata_index'],
                        body=json.dumps(query))
    else:
        res = es.search(index=app.config['elastic_metadata_index'],
                        type=app.config['elastic_metadata_type'],
                        body=json.dumps(query))
    return jsonify(res)


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
