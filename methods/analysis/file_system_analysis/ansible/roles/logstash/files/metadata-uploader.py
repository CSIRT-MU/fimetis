#!/usr/bin/env python3

import sys
import os
import argparse

def main():
    TEMPLATE_LOCATION = '/opt/metadata-uploader/logstash-template.txt'
    INDEX = 'metadata'
    TYPE = 'mactimes'
    parser = argparse.ArgumentParser(description='metadata uploader for file_system_analysis')
    
    #parser.add_argument('-i', '--index', required=True, help='name of the index in elasticsearch')
    #parser.add_argument('-tp', '--template', required=True, help='template logstash file')
    parser.add_argument('-c', '--case', required=True, help='name of the case')
    #parser.add_argument('-t', '--type', required=True, help='type of data')
    parser.add_argument('-f', '--file', required=True, help='path to file')
    parser.add_argument('-ds', '--deleted', required=True, help='remove entries deleted and deleted-realloc')
    args = parser.parse_args()
    template = open(TEMPLATE_LOCATION).read()
    template = template.replace('${CASE}', args.case).replace('${INDEX}', INDEX).replace('${TYPE}', TYPE)

    if args.deleted == 'true':
        template = template.replace('${DELETED_SWITCH}', 'if "(deleted)" in [File Name] or "(deleted-realloc)" in [File Name] { drop { } }')
    else:
        template = template.replace('${DELETED_SWITCH}', '')




    output = open('/etc/logstash/conf.d/' + args.case + '.conf', 'w').write(template)
    os.system('cat ' + args.file + ' | /usr/share/logstash/bin/logstash -f /etc/logstash/conf.d/' + args.case + '.conf')

if __name__ == '__main__':
    main()
