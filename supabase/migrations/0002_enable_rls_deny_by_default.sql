-- 0002_enable_rls_deny_by_default
-- Realize docs/04 section 8: "No table is publicly readable."
-- Enable RLS on every public table with NO policies yet = deny-by-default floor.
-- Capability policies are authored in 0003. This migration only closes the door.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;
