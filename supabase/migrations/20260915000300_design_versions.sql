-- P5: design versions.
--
-- 1. Version numbers are unique per (user, design). The init migration made
--    (design_key, version) globally unique, so another user could insert a row
--    under my design_key (RLS lets anyone insert their own rows with any key)
--    and my next save would hit a unique violation on a row I can't even see.
-- 2. The graph must be a JSON object and stay under 1 MiB; the name is bounded.
--    The app validates the graph shape itself (src/lib/canvas/graph.ts); these
--    are the backstops for writes that skip the app.
alter table public.designs drop constraint designs_design_key_version_key;
alter table public.designs add constraint designs_user_key_version_key unique (user_id, design_key, version);
alter table public.designs add constraint designs_graph_object check (jsonb_typeof(graph) = 'object');
alter table public.designs add constraint designs_graph_size check (pg_column_size(graph) <= 1048576);
alter table public.designs add constraint designs_name_length check (char_length(name) between 1 and 120);
