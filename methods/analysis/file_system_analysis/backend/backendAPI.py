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

es = Elasticsearch()
app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = '/tmp'
app.config['SECRET_KEY'] = 'thisissecretkey'


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']

        if not token:
            return jsonify({'message' : 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'])
            current_user = data['username']
        except:
            return jsonify({'message' : 'Token is invalid!'}), 401

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


@app.route('/case/all', methods=['POST'])
@token_required
def cases(current_user):
    print(request.form)
    es_index = request.form['index']
    es_type = request.form['type']

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

    res = es.search(index=es_index, type=es_type, body=query)
    return jsonify(res)

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
