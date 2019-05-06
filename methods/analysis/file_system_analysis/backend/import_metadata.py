#!/usr/bin/env python

import os
from datetime import datetime
import sys
import csv
from dateutil import parser
from elasticsearch import Elasticsearch
from elasticsearch.exceptions import TransportError
from elasticsearch.helpers import streaming_bulk
# import chardet
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
    with open(csv_file_path, mode='r', errors='ignore') as file:
        reader = csv.DictReader(file)
        for line in reader:
            try:
                line['case'] = case_name
                line['@timestamp'] = parser.parse(line['Date']).strftime('%Y-%m-%dT%H:%M:%S.000Z')
                del line['Date']
                line['Meta'] = int(line['Meta'])
                line['Size'] = int(line['Size'])
                line['UID'] = int(line['UID'])
                line['GID'] = int(line['GID'])
                if remove_deleted and '(deleted)' in line['File Name']:
                    pass
                elif remove_deleted_realloc and '(deleted-realloc)' in line['File Name']:
                    pass
                else:
                    yield line
            except ValueError as valueException:
                logging.error('ERROR ValueError: ' + str(valueException))
                pass


def import_csv(csv_file_path, es_client, es_index, es_type, case_name, remove_deleted=True, remove_deleted_realloc=True,
               delete_source=True):
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
    if delete_source:
        delete_file(csv_file_path)
    send_mail('test@test.com', case_name)


def delete_file(file_path):
    os.remove(file_path)


def send_mail(mail_address, case_name):
    pass


if __name__ == '__main__':
    es_index = 'metadata'
    es_type = 'mactimes'
    if len(sys.argv) == 3:
        es = Elasticsearch()
        _case = sys.argv[1]
        _file = sys.argv[2]
        import_csv(_file, es, es_index, es_type, _case, delete_source=False)
    elif len(sys.argv) == 5:
        es = Elasticsearch([{'host': sys.argv[1], 'port': sys.argv[2]}])
        _case = sys.argv[3]
        _file = sys.argv[4]
        import_csv(_file, es, es_index, es_type, _case, delete_source=False)
    else:
        print('usage:')
        print('1: case_name file_path')
        print('2: elasticsearch_address elasticsearch_port case_name file_path')
