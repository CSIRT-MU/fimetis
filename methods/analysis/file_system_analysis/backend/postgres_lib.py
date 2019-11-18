import psycopg2
from contextlib import closing

PG_USER = 'fimetis'
PG_DB = 'fimetis'


def get_db_connection():
    return psycopg2.connect(database=PG_DB, user=PG_USER, password=None)


def insert_case(name, description):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('INSERT INTO "case" (name, description) VALUES (%s, %s)', (name, description))
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

        cur.execute('DELETE FROM "note" WHERE case_id=%s', (case_id,))
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


def get_accessible_cases(user_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT is_super_admin FROM "user" WHERE login=%s', (user_name,))
        is_super_admin = cur.fetchone()[0]

        if is_super_admin:
            cur.execute('SELECT name FROM "case" ORDER BY name')
            cases = cur.fetchall()
        else:
            cur.execute('SELECT "case".name FROM "case" INNER JOIN "access" ON "case".id="access".case_id '
                        'INNER JOIN "user" ON "user".id="access".user_id WHERE login=%s ORDER BY name', (user_name,))
            cases = cur.fetchall()

    conn.close()

    normalized_result = []
    for case in cases:
        normalized_result.append(case[0])

    return normalized_result


def get_administrated_cases(user_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT is_super_admin FROM "user" WHERE login=%s', (user_name,))
        is_super_admin = cur.fetchone()[0]

        if is_super_admin:
            cur.execute('SELECT id,name,description,created FROM "case" ORDER BY NAME')
            cases = cur.fetchall()
        else:
            cur.execute(
                'SELECT "case".id,name,description,created '
                'FROM "case" INNER JOIN "access" ON "case".id="access".case_id '
                'INNER JOIN "user" ON "user".id="access".user_id WHERE login=%s AND role=%s ORDER BY name',
                (user_name, 'admin')
            )
            cases = cur.fetchall()

        normalized_result = []
        for case in cases:
            normalized_case = {
                'id': case[0],
                'name': case[1],
                'description': case[2],
                'created': case[3],
                'admins': [],
                'users': []
            }

            cur.execute(
                'SELECT login FROM "user" INNER JOIN "access" ON "user".id="access".user_id '
                'WHERE case_id=%s AND role=%s ORDER BY login',
                (normalized_case['id'], 'admin')
            )
            admins = cur.fetchall()

            for admin in admins:
                normalized_case['admins'].append(admin[0])

            cur.execute(
                'SELECT login FROM "user" INNER JOIN "access" ON "user".id="access".user_id '
                'WHERE case_id=%s AND role=%s ORDER BY login',
                (normalized_case['id'], 'user')
            )
            users = cur.fetchall()

            for user in users:
                normalized_case['users'].append(user[0])

            normalized_result.append(normalized_case)

    conn.close()

    return normalized_result


def get_available_users_to_add(case_id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT login FROM "user" WHERE login not in '
                    '(SELECT login FROM "user" INNER JOIN "access" ON "user".id="access".user_id WHERE case_id=%s)'
                    ' ORDER BY login',
                    (case_id,))

        users = cur.fetchall()
        result = []
        for user in users:
            result.append(user[0])

    conn.close()
    return result


def add_user_access_to_case(case_id, login, role):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "access" (case_id, user_id, role) VALUES (%s, %s, %s)', (case_id, user_id, role))
        conn.commit()

    conn.close()


def delete_user_access_to_case(case_id, login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('DELETE FROM "access" WHERE user_id=%s AND case_id=%s', (user_id, case_id))
        conn.commit()

    conn.close()


def update_case_description(case_id, description):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('UPDATE "case" SET description=%s WHERE id=%s', (description, case_id))
        conn.commit()

    conn.close()


def insert_init_note_for_case(case_name, login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "note" (text, case_id, user_id) VALUES (%s, %s, %s)', ('Initial note', case_id, user_id))
        conn.commit()

    conn.close()

def get_note_for_case(case_name, login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('SELECT text FROM "note" WHERE user_id=%s AND case_id=%s', (user_id, case_id))
        text = cur.fetchone()[0]

    conn.close()
    return text


def update_note_for_case(updated_note, case_name, login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('UPDATE "note" SET text=%s WHERE user_id=%s AND case_id=%s', (updated_note, user_id, case_id))
        conn.commit()

    conn.close()


