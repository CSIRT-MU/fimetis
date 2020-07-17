#!/usr/bin/python3

import psycopg2
import argparse
from werkzeug.security import generate_password_hash, check_password_hash


def main():
    users = [
        ('user_01', 'IxeRnEOu'),
        ('user_02', 'ToriErAd'),
        ('user_03', 'ARcuShbU'),
        ('user_04', 'rIcklEtU'),
        ('user_05', 'IGENtErt'),
        ('user_06', 'CIVOloTh'),
        ('user_07', 'ROPOKeIG'),
        ('user_08', 'KNiCatIV'),
        ('user_09', 'hREMycHi'),
        ('user_10', 'idEnchal'),
        ('user_11', 'ItIcENDe'),
        ('user_12', 'FersisMa'),
        ('user_13', 'iMeROkET'),
        ('user_14', 'EMparCul'),
        ('user_15', 'HEThAuSH'),
        ('user_16', 'nICIbuRD'),
        ('user_17', 'YnEWSWIT'),
        ('user_18', 'hOwINGan'),
        ('user_19', 'URsALATE'),
        ('user_20', 'tishILat')
    ]
    conn = psycopg2.connect(database='fimetis', user='fimetis', password=None)

    cur = conn.cursor()

    cur.execute('INSERT INTO "case" (name, description) VALUES (%s, %s) RETURNING id',
                ('Demonstration', 'Dataset for demonstration'))
    case_id = cur.fetchone()[0]

    cur.execute('SELECT id FROM "cluster"');
    clusters = cur.fetchall()

    cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES (%s, %s, %s)', (1, case_id, 'admin'))
    cur.execute('INSERT INTO "note" (text, user_id, case_id) VALUES (%s, %s, %s)', ('Initial note', 1, case_id))

    for cluster in clusters:
        cur.execute('INSERT INTO "user-cluster-case" (user_id, case_id, cluster_id) VALUES (%s, %s, %s)',
                    (1, case_id, cluster[0]))

    #    password_hash = generate_password_hash('timesix-elk')
    for i in range(0, len(users)):
        password_hash = generate_password_hash(users[i][1])
        user = users[i][0]
        cur.execute('INSERT INTO "user" (login, name, password, is_super_admin) VALUES (%s, %s, %s, %s) RETURNING id',
                    (user, user, password_hash, False))
        user_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES(%s, %s, %s)', (user_id, case_id, 'user'))
        cur.execute('INSERT INTO "note" (text, user_id, case_id) VALUES (%s, %s, %s)',
                    ('Initial note', user_id, case_id))
        for cluster in clusters:
            cur.execute('INSERT INTO "user-cluster-case" (user_id, case_id, cluster_id) VALUES (%s, %s, %s)',
                        (user_id, case_id, cluster[0]))

    conn.commit()
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
