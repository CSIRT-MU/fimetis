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
import import_metadata
import tempfile

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = '/tmp'
app.config['SECRET_KEY'] = os.urandom(128)
app.config['elastic_metadata_index'] = 'metadata'
app.config['elastic_metadata_type'] = 'mactimes'
app.config['elastic_filter_index'] = 'filter'
app.config['elastic_filter_type'] = None
app.config['elastic_user_index'] = 'user'
app.config['elastic_user_type'] = None
app.config['TOKEN_EXPIRATION'] = datetime.timedelta(days=1)
app.config['elastic_host'] = 'localhost'
app.config['elastic_port'] = 9200
es = Elasticsearch([{'host': app.config['elastic_host'], 'port': app.config['elastic_port']}])


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
            current_user = {'username': data['username'],
                            'groups': data['groups']}
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)

    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            current_user = args[0]
        except:
            return jsonify({'message': 'This user is not authorized'}), 403
        authorized = False
        for group in current_user['groups']:
            if group == 'admin':
                authorized = True
                break
        if not authorized:
            return jsonify({'message': 'This user is not authorized'}), 403
        return f(*args, **kwargs)
    return decorated


# def authorization_required(f):
#     @wraps(f)
#     def decorated(*args, **kwargs):
#         roles = ['admin']
#         for arg in args:
#             print(arg)
#         for kwarg in kwargs:
#             print(kwarg)
#         current_user = {'groups': ['admin']}
#         if roles is not None:
#             authorized = False
#             for group in current_user['groups']:
#                 if group in roles:
#                     authorized = True
#                     break
#             if not authorized:
#                 return jsonify({'message': 'This user is not authorized'}), 401
#         return f(*args, *kwargs)
#     return decorated


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
                return jsonify({'username': username, 'groups': groups, 'token': token.decode('UTF-8')})
    return jsonify({'message': 'Wrong username or password'}), 400


@app.route('/authenticated', methods=['GET', 'POST'])
@token_required
def authenticated():
    return jsonify({'authenticated': 'OK'}), 200


@app.route('/')
@token_required
def es_info():
    return jsonify(es.info())


@app.route('/upload', methods=['POST'])
@token_required
@admin_required
def upload(current_user):
    if 'case' not in request.form:
        return jsonify({'status': 'failed', 'message': 'Case name is missing in form'})
    else:
        case_name = request.form['case']
    if 'removeDeleted' not in request.form:
        remove_deleted = True
    else:
        remove_deleted = request.form['removeDeleted'] in ('true', '1')
    if 'removeDeletedRealloc' not in request.form:
        remove_deleted_realloc = True
    else:
        remove_deleted_realloc = request.form['removeDeletedRealloc'] in ('true', '1')
    if 'file' not in request.files:
        return jsonify({'status': 'failed', 'message': 'No file to upload'})
    for file in request.files.getlist('file'):
        print(file)
        if file.filename == '':
            return jsonify({'status': 'failed', 'message': 'Invalid file name'})
        if file:
            tf = tempfile.NamedTemporaryFile(suffix='-' + secure_filename(file.filename),
                                             dir=app.config['UPLOAD_FOLDER'],
                                             delete=False)
            file.save(tf.name)
            import_metadata.import_csv(tf.name,
                                       es,
                                       app.config['elastic_metadata_index'],
                                       app.config['elastic_metadata_type'],
                                       case_name,
                                       remove_deleted=remove_deleted,
                                       remove_deleted_realloc=remove_deleted_realloc)
            # subprocess.Popen(['python3', './metadata-uploader.py', '-c', case, '-f', sys_path, '-ds', 'true'])
    return jsonify({'status': 'OK', 'message': 'uploading files'})


@app.route('/case/delete/<string:case>', methods=['DELETE'])
@token_required
@admin_required
def delete_case(current_user, case):
    body = {
      'query': {
        'match_phrase': {
          'case': case
        }
      }
    }
    res = es.delete_by_query(index=app.config['elastic_metadata_index'],
                             doc_type=app.config['elastic_metadata_type'],
                             body=body)
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
    return jsonify(filters=res['aggregations']['filters']['buckets'])


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
    return jsonify(res['hits']['hits'][0]['_source'])


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
    #print(res)
    return jsonify(res)


@app.route('/clusters/entries_border/<string:case>', methods=['POST'])
@token_required
def clusters_entries_border(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')

    query = fsa.build_data_query(case, clusters, additional_filters, 0, 1, 'timestamp', 'asc')
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

    first = es.search(index=app.config['elastic_metadata_index'],
                      doc_type=app.config['elastic_metadata_type'],
                      body=json.dumps(first_query))
    last = es.search(index=app.config['elastic_metadata_index'],
                     doc_type=app.config['elastic_metadata_type'],
                     body=json.dumps(last_query))
    res = []
    if first is not None:
        res.append(first['hits']['hits'][0])
    if last is not None:
        res.append(last['hits']['hits'][0])
    return jsonify(res)


@app.route('/graph/first_and_last/<string:case>', methods=['POST'])
@token_required
def graph_get_first_and_last_entry(current_user, case):
    first_query = fsa.build_whole_case_first_entry_query(case, 'asc')
    last_query = fsa.build_whole_case_first_entry_query(case, 'desc')

    first = es.search(index=app.config['elastic_metadata_index'],
                      doc_type=app.config['elastic_metadata_type'],
                      body=json.dumps(first_query))
    last = es.search(index=app.config['elastic_metadata_index'],
                     doc_type=app.config['elastic_metadata_type'],
                     body=json.dumps(last_query))
    res = []
    if first is not None:
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
    app.run(debug=True, host='127.0.0.1', port=5000, threaded=True)
