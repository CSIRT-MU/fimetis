#!/usr/bin/python3

import psycopg2
import argparse
from werkzeug.security import generate_password_hash, check_password_hash

def main():
    conn = psycopg2.connect(database='fimetis', user='fimetis', password=None)

    cur = conn.cursor()

    cur.execute('INSERT INTO "case" (name, description) VALUES (%s, %s) RETURNING id', ('incident', 'Dataset for user evaluation'))
    case_id = cur.fetchone()[0]

    cur.execute('SELECT id FROM "cluster"');
    clusters = cur.fetchall()

    cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES (%s, %s, %s)', (1, case_id, 'admin'))
    cur.execute('INSERT INTO "note" (text, user_id, case_id) VALUES (%s, %s, %s)', ('Initial note', 1, case_id))

    for cluster in clusters:
        cur.execute('INSERT INTO "user-cluster-case" (user_id, case_id, cluster_id) VALUES (%s, %s, %s)', (1, case_id, cluster[0]))

    password_hash = generate_password_hash('timesix-elk')
    for i in range(1, 21):
        cur.execute('INSERT INTO "user" (login, password, is_super_admin) VALUES (%s, %s, %s) RETURNING id', ('user_' + str(i).zfill(2), password_hash, False))
        user_id = cur.fetchone()[0]
        
        cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES(%s, %s, %s)', (user_id, case_id, 'user'))
        cur.execute('INSERT INTO "note" (text, user_id, case_id) VALUES (%s, %s, %s)', ('Initial note', user_id, case_id))  
        for cluster in clusters:
            cur.execute('INSERT INTO "user-cluster-case" (user_id, case_id, cluster_id) VALUES (%s, %s, %s)', (user_id, case_id, cluster[0]))

    conn.commit()
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()

