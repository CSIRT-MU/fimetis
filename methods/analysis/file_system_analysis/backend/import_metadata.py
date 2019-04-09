#!/usr/bin/env python

import os
from datetime import datetime
import sys
import csv
from dateutil import parser
from elasticsearch import Elasticsearch
from elasticsearch.exceptions import TransportError
from elasticsearch.helpers import streaming_bulk
import chardet
import logging

logging.basicConfig(format='%(asctime)s %(message)s', level=logging.INFO)


def create_index(client, index):
    create_index_body = {
      'settings': {
        # 'number_of_shards': 1,
        'max_result_window': 20000000,
      }
    }

    # create empty index
    try:
        client.indices.create(
            index=index,
            body=create_index_body,
        )
    except TransportError as e:
        # ignore already existing index
        if e.error == 'index_already_exists_exception':
            pass
        elif e.error == 'resource_already_exists_exception':
            pass
        else:
            raise


def document_stream(csv_file_path, case_name, remove_deleted=True, remove_deleted_realloc=True):
    # with open(csv_file_path, 'rb') as raw_data:
    #     encoding_detection = chardet.detect(raw_data.read())
    # logging.info('Detected encoding: ' + encoding_detection['encoding'])
    # with open(csv_file_path, mode='r', encoding=encoding_detection['encoding'], errors='surrogateescape') as file:
    with open(csv_file_path, mode='r', errors='surrogateescape') as file:
        reader = csv.DictReader(file)
        for line in reader:
            try:
                line['case'] = case_name
                line['@timestamp'] = parser.parse(line['Date']).strftime('%Y-%m-%dT%H:%M:%S.000Z')
                del line['Date']
                if remove_deleted and '(deleted)' in line['File Name']:
                    pass
                elif remove_deleted_realloc and '(deleted-realloc)' in line['File Name']:
                    pass
                else:
                    yield line
            except ValueError as valueException:
                logging.error('ERROR ValueError: ' + str(valueException))
                pass


def import_csv(csv_file_path, es_client, es_index, es_type, case_name, remove_deleted=True, remove_deleted_realloc=True):
    create_index(es_client, es_index)
    logging.info('Import file %s to case: %s' % (csv_file_path, case_name))
    if es_type is None:
        es_type = ''

    for ok, result in streaming_bulk(
            es_client,
            document_stream(csv_file_path, case_name, remove_deleted, remove_deleted_realloc),
            index=es_index,
            doc_type=es_type,
            chunk_size=50  # keep the batch sizes small for appearances only
    ):
        action, result = result.popitem()
        doc_id = '/%s/doc/%s' % (es_index, result['_id'])
        # process the information from ES whether the document has been
        # successfully indexed
        if not ok:
            print('Failed to %s document %s: %r' % (action, doc_id, result))
            logging.warning('Failed to %s document %s: %r' % (action, doc_id, result))
    logging.info('Import of file %s finished' % csv_file_path)
    delete_file(csv_file_path)
    send_mail('test@test.com', case_name)


def delete_file(file_path):
    os.remove(file_path)


def send_mail(mail_address, case_name):
    pass


if __name__ == '__main__':
    # # get trace logger and set level
    # tracer = logging.getLogger('elasticsearch.trace')
    # tracer.setLevel(logging.INFO)
    # tracer.addHandler(logging.FileHandler('/tmp/es_trace.log'))
    #
    # parser = argparse.ArgumentParser()
    # parser.add_argument(
    #     "-H", "--host",
    #     action="store",
    #     default="localhost:9200",
    #     help="The elasticsearch host you wish to connect to. (Default: localhost:9200)")
    # parser.add_argument(
    #     "-p", "--path",
    #     action="store",
    #     default=None,
    #     help="Path to git repo. Commits used as data to load into Elasticsearch. (Default: None")
    #
    # args = parser.parse_args()
    #
    # # instantiate es client, connects to localhost:9200 by default
    # es = Elasticsearch(args.host)
    #
    # # we load the repo and all commits
    # load_repo(es, path=args.path)
    #
    # # run the bulk operations
    # success, _ = bulk(es, UPDATES, index='git')
    # print('Performed %d actions' % success)
    #
    # # we can now make docs visible for searching
    # es.indices.refresh(index='git')
    #
    # # now we can retrieve the documents
    # initial_commit = es.get(index='git', doc_type='doc', id='20fbba1230cabbc0f4644f917c6c2be52b8a63e8')
    # print('%s: %s' % (initial_commit['_id'], initial_commit['_source']['committed_date']))
    #
    # # and now we can count the documents
    # print(es.count(index='git')['count'], 'documents in index')
    es = Elasticsearch()
    import_csv('/tmp/output.lite.mac', es, 'metadata', 'mactimes', 'testcase2')
