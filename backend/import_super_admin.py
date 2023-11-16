#!/usr/bin/python3

import psycopg2
import argparse
from werkzeug.security import generate_password_hash, check_password_hash

def main():
    parser = argparse.ArgumentParser(description='import super admin user in database')
    parser.add_argument('--user', required=True, help='Login of the super user')
    parser.add_argument('--passwd', required=True, help='Password of the super user')

    args = parser.parse_args()

    conn = psycopg2.connect(database='fimetis', user='fimetis', password=None)

    cur = conn.cursor()

    if args.passwd == "disabled":
        passwd = "!" # this won't clash with any hash value
    else:
        passwd = generate_password_hash(args.passwd)

    cur.execute('INSERT INTO "user" (login, password, is_super_admin) VALUES (%s, %s, %s)', (args.user, passwd, True))

    conn.commit()
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
