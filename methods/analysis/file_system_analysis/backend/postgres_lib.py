import psycopg2
from contextlib import closing

PG_USER = 'fimetis'
PG_DB = 'fimetis'


def get_db_connection():
    return psycopg2.connect(database=PG_DB, user=PG_USER, password=None)


def insert_case(name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('INSERT INTO "case" (name) VALUES (%s)', (name,))
        conn.commit()
    conn.close()


def insert_user_case_role(user_name, case_name, role):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (user_name,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES (%s, %s, %s)', (user_id, case_id, role))
        conn.commit()
    conn.close()


def get_user_by_login(login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT password, is_super_admin FROM "user" WHERE login=%s', (login,))
        user = cur.fetchone()
    conn.close()

    return user


def delete_case(case_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]
        cur.execute('DELETE FROM "access" WHERE case_id=%s', (case_id,))

        cur.execute('DELETE FROM "case" WHERE id=%s', (case_id,))
        conn.commit()
    conn.close()


def has_user_admin_access(user_name, case_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]
        cur.execute('SELECT id FROM "user" WHERE login=%s', (user_name,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT * FROM "access" WHERE user_id=%s AND case_id=%s AND role=%s', (user_id, case_id, 'admin'))

        rows = cur.fetchall()

    conn.close()

    return len(rows) == 1

