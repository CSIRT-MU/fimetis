INSERT INTO public.filter (id, name, definition) VALUES (2, 'Select All', '{ "match_all": {} }');
INSERT INTO public.filter (id, name, definition) VALUES (1, 'Filename Regex', '{ "regexp": { "File Name.keyword": "${{FILENAME_REGEX}}$" } }');
INSERT INTO public.filter (id, name, definition) VALUES (3, 'Mode Regex', '{ "regexp": { "Mode.keyword": "${{MODE_REGEX}}$" } }');

