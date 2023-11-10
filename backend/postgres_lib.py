import psycopg2
from contextlib import closing

from app_config import AppConfig


def get_db_connection():
    conf = AppConfig()
    return psycopg2.connect(database=conf.get_str('db_name'), user=conf.get_str('db_user'), password=None)


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
        cur.execute('SELECT password, is_super_admin, email, name FROM "user" WHERE login=%s', (login,))
        user = cur.fetchone()
    conn.close()

    return user


def get_user_groups_names_by_login(login):
    conn = get_db_connection()
    
    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]
        
        cur.execute(
            'SELECT "group".name FROM "group" INNER JOIN "user-group" ON "group".id="user-group".group_id AND user_id=%s',
            (user_id,)
        )
        group_names = cur.fetchall()
        result = []
        for group_name in group_names:
            result.append(group_name[0])
            
    conn.close()
    
    return result


def delete_case(case_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]
        cur.execute('DELETE FROM "access" WHERE case_id=%s', (case_id,))
        cur.execute('DELETE FROM "group-access" WHERE case_id=%s', (case_id,))
        cur.execute('DELETE FROM "note" WHERE case_id=%s', (case_id,))
        cur.execute('DELETE FROM "mark" WHERE case_id=%s', (case_id,))
        cur.execute('DELETE FROM "user-cluster-case" WHERE case_id=%s', (case_id,))

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


def get_accessible_cases(user_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT is_super_admin, id FROM "user" WHERE login=%s', (user_name,))
        user = cur.fetchone()
        is_super_admin = user[0]
        user_id = user[1]

        conf = AppConfig()

        cur.execute(
            'SELECT urn FROM "group" INNER JOIN "user-group" '
            'ON "user-group".group_id="group".id and "group".urn=%s and "group".is_external=%s and user_id=%s',
            (conf.get_str('ext_admin_group_urn'), True, user_id)
        )

        external_super_admin = cur.fetchone() is not None

        cur.execute(
            'SELECT urn FROM "group" INNER JOIN "user-group" '
            'ON "user-group".group_id="group".id and "group".urn=%s and "group".is_external=%s and user_id=%s',
            (conf.get_str('ext_user_group_urn'), True, user_id)
        )

        external_super_reader = cur.fetchone() is not None

        print(is_super_admin, external_super_admin, external_super_reader)
        normalized_result = []

        if is_super_admin or external_super_admin or external_super_reader:
            cur.execute('SELECT "case".id,name,description,created FROM "case" ORDER BY name')

            is_admin = is_super_admin or external_super_admin
            cases = cur.fetchall()
            for case in cases:
                normalized_case = {
                    'id': case[0],
                    'name': case[1],
                    'description': case[2],
                    'created': case[3],
                    'isAdmin': is_admin
                }
                normalized_result.append(normalized_case)
        else:
            cases_dict = {}
            # User access
            cur.execute('SELECT DISTINCT "case".id,"case".name,description,created FROM "case" INNER JOIN "access" ON "case".id="access".case_id '
                        'INNER JOIN "user" ON "user".id="access".user_id WHERE login=%s ORDER BY name', (user_name,))
            user_access_cases = cur.fetchall()

            for case in user_access_cases:
                normalized_case = {
                    'id': case[0],
                    'name': case[1],
                    'description': case[2],
                    'created': case[3]
                }
                cur.execute('SELECT id FROM "user" WHERE login=%s', (user_name,))
                user_id = cur.fetchone()[0]
                cur.execute('SELECT role FROM "access" WHERE user_id=%s and case_id=%s', (user_id, case[0]))
                normalized_case['isAdmin'] = cur.fetchone()[0] == 'admin'
                cases_dict[case[0]] = normalized_case

            # Group access
            cur.execute('SELECT group_id FROM "user-group" WHERE user_id=%s', (user_id,))
            group_ids = cur.fetchall()
            for group_id in group_ids:
                cur.execute('SELECT case_id, "case".name, description, created FROM "group-access" INNER JOIN "case" ON "case".id="group-access".case_id WHERE group_id=%s', (group_id[0],))
                temp_cases = cur.fetchall()
                cur.execute('SELECT role FROM "group" WHERE id=%s', (group_id[0],))
                role = cur.fetchone()[0]
                for temp_case in temp_cases:
                    if temp_case[0] in cases_dict.keys():
                        if role == 'user' or cases_dict[temp_case[0]][isAdmin]:
                            continue
                        else:
                            cases_dict[temp_case[0]][isAdmin] = True
                    else:
                        normalized_case = {
                            'id': temp_case[0],
                            'name': temp_case[1],
                            'description': temp_case[2],
                            'created': temp_case[3],
                            'isAdmin': role == 'admin'
                        }
                        cases_dict[temp_case[0]] = normalized_case

            for key in cases_dict.keys():
                normalized_result.append(cases_dict[key])

    conn.close()

    return normalized_result


def get_all_users():
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute(
            'SELECT id, login, name, preferred_username, email, is_super_admin, is_external FROM "user" ORDER BY login'
        )
        users = cur.fetchall()

        result = []
        for user in users:
            cur.execute('SELECT group_id FROM "user-group" WHERE user_id=%s', (user[0],))
            groups = cur.fetchall()

            group_names = []
            for group in groups:
                cur.execute('SELECT name FROM "group" WHERE id=%s', (group[0],))
                group_names.append(cur.fetchone()[0])

            result.append(
                {
                    'id': user[0],
                    'login': user[1],
                    'name': user[2],
                    'preferred_username': user[3],
                    'email': user[4],
                    'is_super_admin': user[5],
                    'is_external': user[6],
                    'groups': group_names
                })


    conn.close()

    return result


def get_all_groups():
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id, name, urn, role, is_external FROM "group" ORDER BY name')
        groups = cur.fetchall()

        result = []
        for group in groups:
            result.append(
                {
                    'id': group[0],
                    'name': group[1],
                    'urn': group[2],
                    'role': group[3],
                    'is_external': group[4]
                })

    conn.close()

    return result


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


def get_all_marks_for_case_and_user(case_name, login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "mark" WHERE user_id=%s AND case_id=%s', (user_id, case_id))

        marks = cur.fetchall()
        result = []

        for mark in marks:
            result.append(mark[0])

        return result


def insert_mark(case_name, login, id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "mark" (id, case_id, user_id) VALUES (%s, %s, %s)', (id, case_id, user_id))
        conn.commit()

    conn.close()


def delete_mark(case_name, login, id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('DELETE FROM "mark" WHERE id=%s AND case_id=%s AND user_id=%s', (id, case_id, user_id))

        conn.commit()

    conn.close()


def get_all_cluster_definitons():
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id, name, definition, description, filter_id FROM "cluster" ORDER BY id')
        cluster_definitions = cur.fetchall()

        normalized_result = []
        for cluster_definition in cluster_definitions:
            filter_id = cluster_definition[4]

            cur.execute('SELECT id, name, definition FROM "filter" WHERE id=%s', (filter_id,))
            filter_db = cur.fetchone()
            normalized_cluster_definition = {
                'id': cluster_definition[0],
                'name': cluster_definition[1],
                'definition': cluster_definition[2],
                'description': cluster_definition[3],
                'filter_id': filter_db[0],
                'filter_name': filter_db[1],
                'filter_definition': filter_db[2]
            }

            normalized_result.append(normalized_cluster_definition)

    conn.close()
    return normalized_result


def insert_cluster_definition(name, definition, description, filter_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "filter" WHERE name=%s', (filter_name,))
        filter_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "cluster" (name, definition, description, filter_id) VALUES (%s, %s, %s, %s)', (name, definition, description, filter_id))
        conn.commit()
    conn.close()


def delete_cluster_definition(id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('DELETE FROM "cluster" WHERE id=%s', (id,))
        conn.commit()

    conn.close()


def get_filters():
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT name FROM "filter"')

        filters = cur.fetchall()

    conn.close()

    normalized_result = []
    for filter in filters:
        normalized_result.append(filter[0])

    return normalized_result


def get_clusters_for_user_and_case(login, case_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]


        cur.execute('SELECT cluster_id FROM "user-cluster-case" WHERE case_id=%s AND user_id=%s ORDER BY cluster_id', (case_id, user_id))

        cluster_ids = cur.fetchall()

        clusters = []
        for cluster_id in cluster_ids:
            cur.execute('SELECT id, name, definition, description, filter_id FROM "cluster" WHERE id=%s ORDER BY id', (cluster_id[0],))
            cluster_definition = cur.fetchone()

            filter_id = cluster_definition[4]
            cur.execute('SELECT id, name, definition FROM "filter" WHERE id=%s', (filter_id,))
            filter_db = cur.fetchone()
            normalized_cluster_definition = {
                'id': cluster_definition[0],
                'name': cluster_definition[1],
                'definition': cluster_definition[2],
                'description': cluster_definition[3],
                'filter_id': filter_db[0],
                'filter_name': filter_db[1],
                'filter_definition': filter_db[2]
            }

            clusters.append(normalized_cluster_definition)

    conn.close()

    return clusters


def add_user(login, password, name, email):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('INSERT INTO "user" (login, password, name, email, is_external) VALUES (%s, %s, %s, %s, %s)',
                    (login, password, name, email, False))
        conn.commit()

    conn.close()


def add_group(name, role):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('INSERT INTO "group" (name, role, is_external) VALUES (%s, %s, %s)', (name, role, False))
        conn.commit()
    conn.close()


def add_user_clusters_for_case(login, case_name, cluster_ids):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        for cluster_id in cluster_ids:
            cur.execute('INSERT INTO "user-cluster-case" (cluster_id, user_id, case_id) VALUES (%s, %s, %s)', (cluster_id, user_id, case_id))

        conn.commit()

    conn.close()


def delete_user_clusters_from_case(login, case_name, cluster_ids):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        for cluster_id in cluster_ids:
            cur.execute('DELETE FROM "user-cluster-case" WHERE cluster_id=%s AND user_id=%s AND case_id=%s', (cluster_id, user_id, case_id))

        conn.commit()

    conn.close()


def is_user_in_external_group(user_id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute(
            'SELECT urn FROM "user-group" INNER JOIN "group" '
            'ON "user-group".group_id="group".id WHERE user_id=%s and "group".is_external=%s',
            (user_id, True)
        )
        groups = cur.fetchall()

    conn.close()

    conf = AppConfig()
    for group in groups:
        if group[0] in [conf.get_str('ext_admin_group_urn'), conf.get_str('ext_admin_group_urn')]:
            return True

    return False


def add_access_for_many_users_to_case(case_name, full_access_user_ids, read_access_user_ids, cluster_ids):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        for id in full_access_user_ids:
            if is_user_in_external_group(id):
                continue
            cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES (%s, %s, %s)', (id, case_id, 'admin'))
            cur.execute('INSERT INTO "note" (user_id, case_id, text) VALUES (%s, %s, %s)', (id, case_id, 'Initial note'))

            for cluster_id in cluster_ids:
                cur.execute('INSERT INTO "user-cluster-case" (cluster_id, user_id, case_id) VALUES (%s, %s, %s)',
                            (cluster_id, id, case_id))

        for id in read_access_user_ids:
            if is_user_in_external_group(id):
                continue
            cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES (%s, %s, %s)', (id, case_id, 'user'))
            cur.execute('INSERT INTO "note" (user_id, case_id, text) VALUES (%s, %s, %s)', (id, case_id, 'Initial note'))

            for cluster_id in cluster_ids:
                cur.execute('INSERT INTO "user-cluster-case" (cluster_id, user_id, case_id) VALUES (%s, %s, %s)',
                            (cluster_id, id, case_id))

        conn.commit()

    conn.close()


def get_user_ids_with_access_to_case(case_id, role):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT user_id FROM "access" WHERE case_id=%s AND role=%s', (case_id, role))
        ids = cur.fetchall()

        result = []
        for id in ids:
            result.append(id[0])

    conn.close()

    return result


def get_user_ids_in_group(group_id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT user_id FROM "user-group" WHERE group_id=%s', (group_id,))
        ids = cur.fetchall()

        result = []
        for id in ids:
            result.append(id[0])

    conn.close()

    return result


def manage_access_for_many_users_to_case(case_id, role, user_ids_to_add, user_ids_to_del):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "cluster" ORDER BY id')
        cluster_ids = cur.fetchall()

        for user_id in user_ids_to_add:
            cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES (%s, %s, %s)', (user_id, case_id, role))
            if is_user_in_external_group(user_id):
                continue
            cur.execute('INSERT INTO "note" (text, case_id, user_id) VALUES (%s, %s, %s)', ('Initial note', case_id, user_id))

            for cluster_id in cluster_ids:
                cur.execute('INSERT INTO "user-cluster-case" (cluster_id, user_id, case_id) VALUES (%s, %s, %s)',
                            (cluster_id[0], user_id, case_id))

        for user_id in user_ids_to_del:
            if not is_user_in_external_group(user_id):
                cur.execute('DELETE FROM "user-cluster-case" WHERE user_id=%s AND case_id=%s', (user_id, case_id))
                cur.execute('DELETE FROM "note" WHERE user_id=%s AND case_id=%s', (user_id, case_id))
            cur.execute('DELETE FROM "access" WHERE user_id=%s AND case_id=%s AND role=%s', (user_id, case_id, role))

        conn.commit()

    conn.close()


def manage_access_for_many_groups_to_case(case_id, group_ids_to_add, group_ids_to_del):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cluster_ids = get_all_cluster_ids()

        for group_id in group_ids_to_add:
            cur.execute('INSERT INTO "group-access" (group_id, case_id) VALUES (%s, %s)', (group_id, case_id))
            cur.execute('SELECT user_id FROM "user-group" WHERE group_id=%s', (group_id,))
            user_ids = cur.fetchall()
            for user in user_ids:
                if is_user_in_external_group(user[0]):
                    continue
                cur.execute('INSERT INTO "note" (text, case_id, user_id) VALUES (%s, %s, %s)', ('Initial note', case_id, user[0]))
                for cluster_id in cluster_ids:
                    cur.execute('INSERT INTO "user-cluster-case" (cluster_id, user_id, case_id) VALUES (%s, %s, %s)',
                                (cluster_id, user[0], case_id))

        for group_id in group_ids_to_del:
            cur.execute('SELECT user_id FROM "user-group" WHERE group_id=%s', (group_id,))
            user_ids = cur.fetchall()
            for user in user_ids:
                if not is_user_in_external_group(user[0]):
                    cur.execute('DELETE FROM "user-cluster-case" WHERE user_id=%s and case_id=%s', (user[0], case_id))
                    cur.execute('DELETE FROM "note" WHERE case_id=%s and user_id=%s', (case_id, user[0]))
            cur.execute('DELETE FROM "group-access" WHERE group_id=%s and case_id=%s', (group_id, case_id))

        conn.commit()

    conn.close()


def manage_users_in_group(group_id, user_ids_to_add, user_ids_to_del):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        for user_id in user_ids_to_add:
            cur.execute('INSERT INTO "user-group" (user_id, group_id) VALUES (%s, %s)', (user_id, group_id))

        for user_id in user_ids_to_del:
            cur.execute('DELETE FROM "user-group" WHERE user_id=%s and group_id=%s', (user_id, group_id))

        conn.commit()

    conn.close()


def get_group_ids_with_access_to_case(case_id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT group_id FROM "group-access" WHERE case_id=%s', (case_id,))
        ids = []
        group_ids = cur.fetchall()
        for group_id in group_ids:
            ids.append(group_id[0])

    conn.close()

    return ids


def get_all_internal_groups():
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id, name, urn, role, is_external FROM "group" WHERE is_external=%s ORDER BY name', (False,))
        groups = cur.fetchall()

        result = []
        for group in groups:
            result.append(
                {
                    'id': group[0],
                    'name': group[1],
                    'urn': group[2],
                    'role': group[3],
                    'is_external': group[4]
                })

    conn.close()

    return result


def process_oidc_user_login(login, name, preferred_username, email, groups):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id, name, preferred_username, email FROM "user" WHERE login=%s', (login,))

        user = cur.fetchone()

        if user is None:
            cur.execute('INSERT INTO "user" (login, name, preferred_username, email, is_external) '
                        'VALUES (%s, %s, %s, %s, %s) RETURNING id', (login, name, preferred_username, email, True))
            user_id = cur.fetchone()[0]
        else:
            user_id = user[0]
            if user[2] != preferred_username:
                cur.execute('UPDATE "user" SET preferred_username=%s WHERE login=%' (preferred_username, login))
            if user[3] != email:
                cur.execute('UPDATE "user" SET email=%s WHERE login=%'(email, login))

        cluster_ids = get_all_cluster_ids()
        cases_ids = get_all_case_ids()

        for case_id in cases_ids:
            cur.execute('SELECT * FROM "note" WHERE user_id=%s and case_id=%s', (user_id, case_id))
            note_exists = cur.fetchone() is not None

            # if note not exists, for every case and must be generated initial note and clusters
            if not note_exists:
                cur.execute('INSERT INTO "note" (text, user_id, case_id) VALUES (%s, %s, %s)',
                            ('Initial note', user_id, case_id))

                for cluster_id in cluster_ids:
                    cur.execute('INSERT INTO "user-cluster-case" (user_id, cluster_id, case_id) VALUES (%s, %s, %s)',
                        (user_id, cluster_id, case_id))

        for group in groups:
            cur.execute('SELECT id FROM "group" WHERE urn=%s', (group,))

            group_db = cur.fetchone()
            if group_db is None:
                continue
            cur.execute('SELECT group_id FROM "user-group" WHERE user_id=%s and group_id=%s', (user_id, group_db[0]))
            user_in_group = cur.fetchone()

            if user_in_group is None:
                cur.execute('INSERT INTO "user-group" (user_id, group_id) VALUES (%s, %s)',
                            (user_id, group_db[0]))
            else:
                continue

        conn.commit()

    conn.close()


def update_note_and_clusters_for_case_for_external_users(case_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        external_user_ids = get_all_external_users_ids()
        cluster_ids = get_all_cluster_ids()
        for user_id in external_user_ids:
            cur.execute('SELECT * FROM "note" WHERE user_id=%s and case_id=%s', (user_id, case_id))
            note_exists = cur.fetchone() is not None

            # if note not exists, for every case and must be generated initial note and clusters
            if not note_exists:
                cur.execute('INSERT INTO "note" (text, user_id, case_id) VALUES (%s, %s, %s)',
                    ('Initial note', user_id, case_id))

                for cluster_id in cluster_ids:
                    cur.execute('INSERT INTO "user-cluster-case" (user_id, cluster_id, case_id) VALUES (%s, %s, %s)',
                        (user_id, cluster_id, case_id))
        conn.commit()
    conn.close()


def get_all_external_users_ids():
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE is_external=%s', (True,))
        result = cur.fetchall()

    conn.close()
    ids = []
    for i in result:
        ids.append(i[0])

    return ids


def get_all_cluster_ids():
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "cluster"')
        result = cur.fetchall()

    conn.close()
    ids = []
    for i in result:
        ids.append(i[0])

    return ids


def get_all_case_ids():
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "case"')
        result = cur.fetchall()

    conn.close()
    ids = []
    for i in result:
        ids.append(i[0])

    return ids