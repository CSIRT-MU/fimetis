INSERT INTO "case" (name, description) VALUES ('test', 'dataset that tests uploading');
INSERT INTO "access" (user_id, case_id, role) VALUES (1, 1, 'admin');
INSERT INTO "note" (text, case_id, user_id) VALUES ('Initial note', 1, 1);
