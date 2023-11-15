CREATE SEQUENCE case_id_seq;

CREATE TABLE "case" (
  id int NOT NULL PRIMARY KEY default nextval('case_id_seq'), 
  name varchar(64) NOT NULL, 
  description varchar(128), 
  created timestamp NOT NULL DEFAULT now()
);

CREATE SEQUENCE user_id_seq;

CREATE TABLE "user" (
  id int NOT NULL PRIMARY KEY default nextval('user_id_seq'), 
  login character varying(64) NOT NULL,
  password character varying(256),
  name character varying(128),
  email character varying(64),
  is_super_admin boolean DEFAULT false NOT NULL,
  preferred_username character varying(64),
  is_external boolean DEFAULT false
);

CREATE TYPE fimetis_role AS ENUM ('admin', 'user');

CREATE TABLE "access" (
  user_id int REFERENCES "user"(id), 
  case_id int REFERENCES "case"(id), 
  role fimetis_role NOT NULL default 'user'
);

CREATE SEQUENCE note_id_seq;

CREATE TABLE "note" (
  id int NOT NULL PRIMARY KEY default nextval('note_id_seq'),
  text varchar(2048),
  user_id int REFERENCES "user"(id),
  case_id int REFERENCES "case"(id)
);

CREATE TABLE "mark" (
  id varchar(64) NOT NULL,
  user_id int REFERENCES "user"(id),
  case_id int REFERENCES "case"(id)
);

CREATE SEQUENCE filter_id_seq;

CREATE TABLE "filter" (
  id int NOT NULL PRIMARY KEY default nextval('filter_id_seq'),
  name varchar(64) NOT NULL,
  definition varchar(2048) NOT NULL
);

CREATE SEQUENCE cluster_id_seq;

CREATE TABLE "cluster" (
  id int NOT NULL PRIMARY KEY default nextval('cluster_id_seq'),
  name varchar(128) NOT NULL,
  filter_id int REFERENCES "filter"(id),
  definition varchar(2048) NOT NULL,
  description varchar(2048)
);

CREATE TABLE "user-cluster-case" (
  cluster_id int REFERENCES "cluster"(id),
  user_id int REFERENCES "user"(id),
  case_id int REFERENCES "case"(id)
);

CREATE SEQUENCE group_id_seq;

CREATE TABLE "group" (
  id int NOT NULL PRIMARY KEY default nextval('group_id_seq'),
  name varchar(128) NOT NULL,
  urn varchar(256) NOT NULL,
  role fimetis_role NOT NULL DEFAULT 'user',
  is_external boolean DEFAULT false
);

INSERT INTO "group" (name, urn, role) VALUES({{ oidc_user_group_name }}, {{ oidc_user_group_urn }}, 'user');
INSERT INTO "group" (name, urn, role) VALUES({{ oidc_admin_group_name }}, {{ oidc_admin_group_urn }}, 'admin');


CREATE TABLE "user-group" (
  user_id int REFERENCES "user"(id),
  group_id int REFERENCES "group"(id)
);

CREATE TABLE "group-access" (
  group_id int REFERENCES "group"(id),
  case_id int REFERENCES "case"(id)
);


