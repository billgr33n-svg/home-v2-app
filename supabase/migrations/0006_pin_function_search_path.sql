-- 0006_pin_function_search_path
-- Pin search_path on the two trigger helpers (clears function_search_path_mutable).
-- They touch only trigger record fields and pg_catalog now(), so empty path is safe.
create or replace function app.bump_version() returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  return new;
end $$;

create or replace function app.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
