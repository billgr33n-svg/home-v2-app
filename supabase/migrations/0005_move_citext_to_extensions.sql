-- 0005_move_citext_to_extensions
-- Clear the "extension in public" advisory. Supabase keeps a dedicated
-- extensions schema on the search_path ("$user", public, extensions), so
-- citext operators stay resolvable (verified).
alter extension citext set schema extensions;
