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
import argparse

# logging.basicConfig(format='%(asctime)s %(levelname)-8s %(name)s %(message)s', level=logging.INFO)

mappings =  {
  "properties": {
    "@timestamp": { "type": "date" },
    "File Name": {
      "type": "text",
      "fields": {
        "keyword": {
          "type": "keyword",
          "ignore_above": 4096
        }
      }
    },
    "GID": { "type": "long" },
    "Meta": { "type": "long" },
    "Mode": {
      "type": "text",
      "fields": {
        "keyword": {
          "type": "keyword",
          "ignore_above": 10
        }
      }
    },
    "Size": { "type": "long" },
    "Type": {
      "type": "text",
      "fields": {
        "keyword": {
          "type": "keyword",
          "ignore_above": 4
        }
      }
    },
    "UID": { "type": "long" },
    "case": {
      "type": "text",
      "fields": {
        "keyword": {
          "type": "keyword",
          "ignore_above": 256
        }
      }
    }
  }
}


def create_index(client, index, es_type):
    create_index_body = {
      'settings': {
        # 'number_of_shards': 1,
        'max_result_window': 20000000,
      },
      'mappings': {
        es_type: mappings,
      }
    }

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


def l2tcsv_stream(csv_file_path, case_name, remove_deleted=True, remove_deleted_realloc=True):
    with open(csv_file_path, mode='r', errors='ignore') as file:
        reader = csv.DictReader(file)
        for line in reader:
            try:
                # date,time,timezone,MACB,source,sourcetype,type,user,host,short,desc,version,filename,inode,notes,format,extra
                timestamp = '%s %s' %(line['date'], line['time'])
                line['case'] = case_name
                line['@timestamp'] = parser.parse(timestamp).strftime('%Y-%m-%dT%H:%M:%S.000Z')
                del line['date']
                del line['time']
                del line['timezone']
                line['Type'] = line['MACB'].lower()
                line['Meta'] = int(line['inode'])
                line['Size'] = int(0)
                line['UID'] = int(-1)
                line['GID'] = int(-1)
                line['File Name'] = line['filename']

                # discarded columns
                del line['source']
                del line['sourcetype']
                del line['type']
                del line['user']
                del line['host']
                del line['short']
                del line['desc']
                del line['version']
                del line['notes']
                del line['format']
                del line['extra']

                if remove_deleted and '(deleted)' in line['File Name']:
                    pass
                elif remove_deleted_realloc and '(deleted-realloc)' in line['File Name']:
                    pass
                else:
                    yield line
            except ValueError as valueException:
                logging.error('ERROR ValueError: ' + str(line))
                pass


def mactime_stream(csv_file_path, case_name, remove_deleted=True, remove_deleted_realloc=True):
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
                logging.error('ERROR ValueError: ' + str(line))
                pass


def import_csv(csv_file_path, file_type, es_client, es_index, es_type, case_name, remove_deleted=True, remove_deleted_realloc=True,
               delete_source=True):
    create_index(es_client, es_index, es_type)
    logging.info('Import file %s to case: %s' % (csv_file_path, case_name))
    if es_type is None:
        es_type = ''

    if file_type == 'l2tcsv':
        stream = l2tcsv_stream
    else:
        stream = mactime_stream

    for ok, result in streaming_bulk(
            es_client,
            stream(csv_file_path, case_name, remove_deleted, remove_deleted_realloc),
            index=es_index,
            doc_type=es_type,
            chunk_size=5000  # keep the batch sizes small for appearances only
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

    arg_parser = argparse.ArgumentParser(description='Import timestamps into elastic')
    arg_parser.add_argument('--input_file', required=True, help='Path to input file')
    arg_parser.add_argument('--case', required=True, help='Name of the case')
    arg_parser.add_argument('--format', required=True, help='mactime or l2tcsv')

    args = arg_parser.parse_args()
    es = Elasticsearch()    
    if args.format not in ['mactime', 'l2tcsv']:
        print('Unsupported format')
        sys.exit()
    
    import_csv(args.input_file, args.format, es, es_index, es_type, args.case, delete_source=False)
