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
import type_recognizer
import postgres_lib as pg
import tempfile
import logging

logging.basicConfig(format='%(asctime)s %(levelname)-8s %(message)s', level=logging.INFO)

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
app.config['pg_user'] = 'fimetis'
app.config['pg_db'] = 'fimetis'
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
                            'is_super_admin': data['is_super_admin']}
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
        if current_user['is_super_admin']:
            authorized = True
        # for group in current_user['groups']:
        #     if group == 'admin':
        #         authorized = True
        #         break
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
        logging.warning('LOGIN - Wrong username or password')
        return jsonify({'message': 'Wrong username or password'}), 400

    username = request.get_json()['username']
    user = pg.get_user_by_login(username)
    password_hash = user[0]
    is_super_admin = user[1]

    if check_password_hash(password_hash, request.get_json()['password']):
        token = jwt.encode(
            {
                'username': username,
                'is_super_admin': is_super_admin,
                'exp': datetime.datetime.utcnow() + app.config['TOKEN_EXPIRATION']
            }, app.config['SECRET_KEY']
        )
        logging.warning('LOGIN - successful for user: ' + str(username) + ' from ' + str(request.remote_addr))
        return jsonify({'username': username, 'is_super_admin': is_super_admin, 'token': token.decode('UTF-8')})

    logging.warning('LOGIN - Wrong username or password')
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
def upload(current_user):
    if 'case' not in request.form:
        return jsonify({'status': 'failed', 'message': 'Case name is missing in form'})
    else:
        case_name = request.form['case']

    if 'description' not in request.form:
        description = ''
    else:
        description = request.form['description']

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
        logging.info('upload file: ' + str(file) + ' to case: ' + str(case_name))
        if file.filename == '':
            return jsonify({'status': 'failed', 'message': 'Invalid file name'})
        if file:
            tf = tempfile.NamedTemporaryFile(suffix='-' + secure_filename(file.filename),
                                             dir=app.config['UPLOAD_FOLDER'],
                                             delete=False)
            file.save(tf.name)

            file_type = type_recognizer.recognize_type(tf.name)
            if file_type == 'fls':
                normalized_file = tf.name + '.norm'
                os.system('mactime -b %s -d > %s' % (tf.name, normalized_file))
                os.system('rm %s' % (tf.name))
            elif file_type == 'find':
                normalized_file = tf.name + '.norm'
                fls_file = tf.name + '.fls'
                os.system('python3 find2fls.py --input_file %s --output_file %s' % (tf.name, fls_file))
                os.system('rm %s' % (tf.name))
                os.system('mactime -b %s -d > %s' % (fls_file, normalized_file))
                os.system('rm %s' % fls_file)
            elif file_type == 'mactime_noheader':
                normalized_file = tf.name
                with open(tf.name, "r+") as f:
                    content = f.read()
                    f.seek(0, 0)
                    f.write('Date,Size,Type,Mode,UID,GID,Meta,File Name\n')
                    f.write(content)
            elif file_type == 'l2tcsv':
                normalized_file = tf.name
            else:
                normalized_file = tf.name

            import_metadata.import_csv(normalized_file,
                                       file_type,
                                       es,
                                       app.config['elastic_metadata_index'],
                                       app.config['elastic_metadata_type'],
                                       case_name,
                                       remove_deleted=remove_deleted,
                                       remove_deleted_realloc=remove_deleted_realloc)

            if request.form['datasetExtend'] == 'false':
                pg.insert_case(case_name, description)
                pg.insert_user_case_role(current_user['username'], case_name, 'admin')
                pg.insert_init_note_for_case(case_name, current_user['username'])
                cluster_ids = json.loads(request.form['cluster_ids'])
                pg.add_user_clusters_for_case(current_user['username'], case_name, cluster_ids)


                full_access_ids = json.loads(request.form['full_access_ids'])
                read_access_ids = json.loads(request.form['read_access_ids'])
                print(full_access_ids, read_access_ids)

                pg.add_access_for_many_users_to_case(case_name, full_access_ids, read_access_ids, cluster_ids)

    return jsonify({'status': 'OK', 'message': 'uploading files'})


@app.route('/case/delete/<string:case>', methods=['DELETE'])
@token_required
@admin_required
def delete_case(current_user, case):
    if not pg.has_user_admin_access(current_user['username'], case):
        return jsonify({'status': 'failed', 'message': 'User has not admin access for this case'})

    pg.delete_case(case)

    query = {
      'query': {
        'match_phrase': {
          'case': case
        }
      }
    }
    logging.info('QUERY delete case: ' + '\n' + json.dumps(query))
    res = es.delete_by_query(index=app.config['elastic_metadata_index'],
                             doc_type=app.config['elastic_metadata_type'],
                             body=query)
    return jsonify(res)


@app.route('/case/accessible', methods=['GET'])
@token_required
def accessible_cases(current_user):
    logging.info('Listed accessible cases for user %s', (current_user['username']))
    return jsonify(cases=pg.get_accessible_cases(current_user['username']))


@app.route('/case/administrated', methods=['GET'])
@token_required
def administrated_cases(current_user):
    logging.info('Listed administrated cases for user %s', (current_user['username']))
    return jsonify(cases=pg.get_administrated_cases(current_user['username']))


@app.route('/user/available', methods=['POST'])
@token_required
def get_available_users_to_add(current_user):
    case_id = request.json.get('case_id')

    logging.info('Listed available users to add access to case %s', (case_id))
    return jsonify(cases=pg.get_available_users_to_add(case_id))


@app.route('/user/all', methods=['GET'])
@token_required
def get_all_users(current_user):

    return jsonify(users=pg.get_all_users(current_user['username']))


@app.route('/case/add-user', methods=['POST'])
@token_required
def add_user_access_to_case(current_user):
    case_id = request.json.get('case_id')
    user_login = request.json.get('user_login')
    role = request.json.get('role')

    pg.add_user_access_to_case(case_id, user_login, role)

    logging.info('User %s access to case %s added', (user_login, case_id))
    return jsonify({'user access to case added': 'OK'}), 200


@app.route('/case/delete-user', methods=['POST'])
@token_required
def delete_user_access_to_case(current_user):
    case_id = request.json.get('case_id')
    user_login = request.json.get('user_login')

    pg.delete_user_access_to_case(case_id, user_login)

    logging.info('User %s access to case %s deleted', (user_login, case_id))
    return jsonify({'user access to case deleted': 'OK'}), 200


@app.route('/case/update-description', methods=['POST'])
@token_required
def update_case_description(current_user):
    case_id = request.json.get('case_id')
    description = request.json.get('description')

    pg.update_case_description(case_id, description)

    logging.info('Case %s description updated', (case_id))
    return jsonify({'case description updated': 'OK'}), 200


@app.route('/case/note', methods=['POST'])
@token_required
def get_note_for_case(current_user):
    case_name = request.json.get('case_name')

    note = pg.get_note_for_case(case_name, current_user['username'])
    #logging.info('Getting note for user %s and case %s', (current_user['username'], case_name,))
    return jsonify(note=note)


@app.route('/case/note/update', methods=['POST'])
@token_required
def update_note_for_case(current_user):
    case_name = request.json.get('case_name')
    updated_note = request.json.get('updated_note')

    pg.update_note_for_case(updated_note, case_name, current_user['username'])

    #logging.info('Updating note for user %s and case %s', (current_user['username'], case_name,))
    return jsonify({'note for case was updated': 'OK'}), 200


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
    logging.info('QUERY get all filters: ' + '\n' + json.dumps(query))
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
    logging.info('QUERY filter by name: ' + '\n' + json.dumps(query))
    res = es.search(index=app.config['elastic_filter_index'], doc_type=app.config['elastic_filter_type'], body=query)
    return jsonify(res['hits']['hits'][0]['_source'])


@app.route('/clusters/data/<string:case>', methods=['POST'])
@token_required
def clusters_get_data(current_user, case):
    clusters = request.json.get('clusters')
    marks_ids = request.json.get('marks_ids')
    additional_filters = request.json.get('additional_filters')
    begin = request.json.get('begin')
    page_size = request.json.get('page_size')
    sort = request.json.get('sort')
    sort_order = request.json.get('sort_order')

    mark_query = {}
    mark_query['ids'] = { 'values' : marks_ids}

    query = fsa.build_data_query(case, clusters, additional_filters, begin, page_size, sort, sort_order)
    query['query']['bool']['must'][1]['bool']['should'].append(mark_query)

    logging.info('QUERY cluster get data: ' + '\n' + json.dumps(query))
    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(query))
    #print(res)
    return jsonify(res)


@app.route('/clusters/get_rank_of_marked_mactime_by_id/<string:case>', methods=['POST'])
@token_required
def get_rank_of_marked_mactime_by_id(current_user, case):
    clusters = request.json.get('clusters')
    marks_ids = request.json.get('marks_ids')
    additional_filters = request.json.get('additional_filters')
    begin = 0
    size = request.json.get('size')
    sort = request.json.get('sort')
    sort_order = request.json.get('sort_order')
    mark_id = request.json.get('mark_id')

    mark_query = {}
    mark_query['ids'] = {'values': marks_ids}

    query = fsa.build_data_query(case, clusters, additional_filters, begin, size, sort, sort_order)
    query['query']['bool']['must'][1]['bool']['should'].append(mark_query)

    query['_source'] = False

    logging.info('QUERY cluster get data: ' + '\n' + json.dumps(query))
    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(query))

    rank = 0
    for entry in res['hits']['hits']:
        if mark_id == entry['_id']:
            break
        rank += 1

    return {'rank': rank}


@app.route('/clusters/get_rank_of_mactime_by_timestamp/<string:case>', methods=['POST'])
@token_required
def get_rank_of_mactime_by_timestamp(current_user, case):
    clusters = request.json.get('clusters')
    marks_ids = request.json.get('marks_ids')
    additional_filters = request.json.get('additional_filters')
    begin = 0
    size = request.json.get('size')
    sort = request.json.get('sort')
    sort_order = request.json.get('sort_order')

    timestamp = request.json.get('timestamp')

    mark_query = {}
    mark_query['ids'] = {'values': marks_ids}

    query = fsa.build_data_query(case, clusters, additional_filters, begin, size, sort, sort_order)
    query['query']['bool']['must'][1]['bool']['should'].append(mark_query)

    query['_source'] = ['@timestamp']

    logging.info('QUERY cluster get data: ' + '\n' + json.dumps(query))
    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(query))

    rank = 0
    for entry in res['hits']['hits']:
        if entry['_source']['@timestamp'] < timestamp:
            rank += 1
        else:
            break

    return {'rank': rank}


@app.route('/clusters/entries_border/<string:case>', methods=['POST'])
@token_required
def clusters_entries_border(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')

    query = fsa.build_data_query(case, clusters, additional_filters, 0, 1, 'timestamp', 'asc')
    logging.info('QUERY cluster entries border: ' + '\n' + json.dumps(query))
    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(query))
    return jsonify(res)


@app.route('/clusters/data_counts/<string:case>', methods=['POST'])
@token_required
def clusters_data_counts(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')
    query_filters = fsa.build_data_query(case, clusters, additional_filters)
    query_all = fsa.build_data_query(case, clusters, None)
    logging.info('QUERY clusters counts: ' + '\n' + json.dumps(query_filters) + '\n' + json.dumps(query_all))
    res_filters = es.search(index=app.config['elastic_metadata_index'],
                            doc_type=app.config['elastic_metadata_type'],
                            body=json.dumps(query_filters))
    res_all = es.search(index=app.config['elastic_metadata_index'],
                        doc_type=app.config['elastic_metadata_type'],
                        body=json.dumps(query_all))
    return jsonify({'total': res_filters['hits']['total'], 'total_all': res_all['hits']['total']})


@app.route('/cluster/count/<string:case>', methods=['POST'])
@token_required
def cluster_get_count(current_user, case):
    cluster = request.json.get('cluster')
    additional_filters = request.json.get('additional_filters')

    query_filters = fsa.build_count_query(case, cluster, additional_filters)
    query_all = fsa.build_count_query(case, cluster, None)
    logging.info('QUERY cluster get count: ' + '\n' + json.dumps(query_filters) + '\n' + json.dumps(query_all))
    res_filters = es.search(index=app.config['elastic_metadata_index'],
                            doc_type=app.config['elastic_metadata_type'],
                            body=json.dumps(query_filters))
    res_all = es.search(index=app.config['elastic_metadata_index'],
                        doc_type=app.config['elastic_metadata_type'],
                        body=json.dumps(query_all))
    return jsonify({'total': res_filters['hits']['total'], 'total_all': res_all['hits']['total']})


@app.route('/cluster/first_and_last/<string:case>', methods=['POST'])
@token_required
def cluster_get_first_and_last_entry(current_user, case):
    clusters = request.json.get('clusters')
    additional_filters = request.json.get('additional_filters')
    mac_type = request.json.get('mac_type')

    first_query = fsa.build_first_entry_query(case, clusters, additional_filters, mac_type, 'asc')
    last_query = fsa.build_first_entry_query(case, clusters, additional_filters, mac_type, 'desc')

    logging.info('QUERY cluster get first and last entry: ' + '\n' + json.dumps(first_query) + '\n' + json.dumps(last_query))
    first = es.search(index=app.config['elastic_metadata_index'],
                      doc_type=app.config['elastic_metadata_type'],
                      body=json.dumps(first_query))
    last = es.search(index=app.config['elastic_metadata_index'],
                     doc_type=app.config['elastic_metadata_type'],
                     body=json.dumps(last_query))
    res = []
    if first is not None:
        if len(first['hits']['hits']) > 0:
            res.append(first['hits']['hits'][0])
    if last is not None:
        if len(last['hits']['hits']) > 0:
            res.append(last['hits']['hits'][0])
    return jsonify(res)


@app.route('/graph/first_and_last/<string:case>', methods=['POST'])
@token_required
def graph_get_first_and_last_entry(current_user, case):
    first_query = fsa.build_whole_case_first_entry_query(case, 'asc')
    last_query = fsa.build_whole_case_first_entry_query(case, 'desc')

    logging.info('QUERY cluster get first and last entry: ' + '\n' + json.dumps(first_query) + '\n' + json.dumps(last_query))
    first = es.search(index=app.config['elastic_metadata_index'],
                      doc_type=app.config['elastic_metadata_type'],
                      body=json.dumps(first_query))
    last = es.search(index=app.config['elastic_metadata_index'],
                     doc_type=app.config['elastic_metadata_type'],
                     body=json.dumps(last_query))
    res = []
    if first is not None:
        if len(first['hits']['hits']) > 0:
            res.append(first['hits']['hits'][0])
    if last is not None:
        if len(last['hits']['hits']) > 0:
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
    logging.info('QUERY graph get data: ' + '\n' + json.dumps(query))
    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(query))
    return jsonify(res)


@app.route('/graph/is_mark_in_cluster/<string:case>', methods=['POST'])
@token_required
def is_mark_in_cluster(current_user, case):
    clusters = request.json.get('clusters')
    timestamp_id = request.json.get('id')

    query = fsa.build_id_presence_query(case, clusters, timestamp_id)
    logging.info('QUERY is mark in cluster: ' + '\n' + json.dumps(query))

    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(query))

    return jsonify(res)


@app.route('/mark/all/<string:case>', methods=['GET'])
@token_required
def get_all_marks_for_case_and_user(current_user, case):

    return jsonify(marks=pg.get_all_marks_for_case_and_user(case, current_user['username']))


@app.route('/mark/get/<string:id>', methods=['GET'])
@token_required
def get_mark_info_by_id(current_user, id):
    id_query = {'_id': [id]}
    mark_query = {'query': {'terms': id_query}}

    res = es.search(index=app.config['elastic_metadata_index'],
                    doc_type=app.config['elastic_metadata_type'],
                    body=json.dumps(mark_query))

    return jsonify(res)


@app.route('/mark/insert/', methods=['POST'])
@token_required
def insert_mark(current_user):
    timestamp_id = request.json.get('id')
    case = request.json.get('case')

    pg.insert_mark(case, current_user['username'], timestamp_id)

    return jsonify({'mark inserted': 'OK'}), 200


@app.route('/mark/delete/', methods=['POST'])
@token_required
def delete_mark(current_user):
    id = request.json.get('id')
    case = request.json.get('case')
    pg.delete_mark(case, current_user['username'], id)

    return jsonify({'mark inserted': 'OK'}), 200


@app.route('/cluster-definition/all', methods=['GET'])
@token_required
def get_all_cluster_definitions(current_user):
    return jsonify(cluster_definitions=pg.get_all_cluster_definitons())


@app.route('/cluster-definition/add', methods=['POST'])
@token_required
def insert_cluster_definition(current_user):
    name = request.json.get('name')
    description = request.json.get('description')
    definition = request.json.get('definition')
    filter_name = request.json.get('filter_name')

    pg.insert_cluster_definition(name, definition, description, filter_name)

    return jsonify({'cluster definition inserted': 'OK'}), 200


@app.route('/cluster-definition/delete/<string:id>', methods=['GET'])
@token_required
def delete_cluster_definition(current_user, id):
    pg.delete_cluster_definition(id)

    return jsonify({'cluster definition deleted': 'OK'}), 200


@app.route('/filter-db/all', methods=['GET'])
@token_required
def get_filters(current_user):

    return jsonify(filters=pg.get_filters())


@app.route('/cluster-definition/case/<string:case>', methods=['GET'])
@token_required
def get_clusters_for_user_and_case(current_user, case):

    return jsonify(cluster_definitions=pg.get_clusters_for_user_and_case(current_user['username'], case))


@app.route('/cluster-definition/case/<string:case>/add-user-clusters', methods=['POST'])
@token_required
def add_user_clusters_for_case(current_user, case):
    cluster_ids = request.json.get('cluster_ids')

    pg.add_user_clusters_for_case(current_user['username'], case, cluster_ids)

    return jsonify({'user clusters added to case': 'OK'}), 200


@app.route('/cluster-definition/case/<string:case>/delete-user-clusters', methods=['POST'])
@token_required
def delete_user_clusters_for_case(current_user, case):
    cluster_ids = request.json.get('cluster_ids')

    pg.delete_user_clusters_from_case(current_user['username'], case, cluster_ids)

    return jsonify({'user clusters deleted from case': 'OK'}), 200


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000, threaded=True)
