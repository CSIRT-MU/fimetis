#!/usr/bin/env python3
import argparse
import os
from werkzeug.security import generate_password_hash


def main():
    parser = argparse.ArgumentParser(description="loader of users to elastic")

    parser.add_argument('--file', required=True, help="Input file with users infos")
    parser.add_argument('--host', required=True, help="Elastic host address with port, like localhost:9200")

    args = parser.parse_args()

    users = open(args.file, 'r').read().split("\n")

    for line in users:
        if line == '':
           break
        if line.startswith('#'):
            continue

        user_splitted = line.split(":")
        
        username = user_splitted[0]
        password = user_splitted[1]
        groups = ''

        groups_splitted = user_splitted[2].split(',')
        for group in user_splitted[2].split(','):
           groups = groups + '"' + group + '"' +','

        groups = groups[:-1]
        groups = '[' + groups + ']' 

        body = '{"username": "' + username + '", "password": "' + generate_password_hash(password) + '", "groups": ' + groups + '}'
        os.system('curl -XPOST {0}/user/data/ -H "Content-Type: application/json" -d \'{1}\''.format(args.host, body))
 
        
        

if __name__ == '__main__':
    main()
