-- 0004_hardening (fulfils the spec's "012_hardening" role).
-- Soft-delete, optimistic concurrency, updated_at + audit triggers, CHECK constraints.

-- 1. Soft-delete columns on the substantive domain tables (ADR-0006).
do $$
declare t text;
  arr text[] := array['households','properties','locations','events','rides','announcements',
    'polls','recipes','meals','inventory_items','shopping_items','tasks','home_assets',
    'maintenance_issues','service_records','attachments','comments'];
begin
  foreach t in array arr loop
    execute format('alter table public.%I add column if not exists deleted_at timestamptz;', t);
  end loop;
end $$;

-- 2. FK policy: household_id -> households cascade becomes restrict, so a household
--    cannot be hard-deleted out from under its audited history (ADR-0006).
do $$
declare r record;
begin
  for r in
    select con.conname, rel.relname as tbl
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and con.contype = 'f'
      and con.confrelid = 'public.households'::regclass
      and con.confdeltype = 'c'
  loop
    execute format('alter table public.%I drop constraint %I', r.tbl, r.conname);
    execute format('alter table public.%I add constraint %I foreign key (household_id) references public.households(id) on delete restrict', r.tbl, r.conname);
  end loop;
end $$;

-- 3. Optimistic concurrency: version columns on contended objects (ADR-0008).
alter table public.rides add column if not exists version int not null default 1;
alter table public.tasks add column if not exists version int not null default 1;
alter table public.polls add column if not exists version int not null default 1;

create or replace function app.bump_version() returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  return new;
end $$;

create trigger trg_bump_version before update on public.rides for each row execute function app.bump_version();
create trigger trg_bump_version before update on public.tasks for each row execute function app.bump_version();
create trigger trg_bump_version before update on public.polls for each row execute function app.bump_version();

-- 4. updated_at maintenance on mutable tables.
create or replace function app.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
  arr text[] := array['profiles','households','events','rides','inventory_items','tasks','maintenance_issues'];
begin
  foreach t in array arr loop
    execute format('create trigger trg_touch_updated_at before update on public.%I for each row execute function app.touch_updated_at();', t);
  end loop;
end $$;

-- 5. Trigger-based audit on the audit-critical tables. SECURITY DEFINER so it can
--    insert into audit_events, which has no client write policy.
create or replace function app.write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare hh uuid; oid_ uuid;
begin
  if tg_op = 'DELETE' then hh := old.household_id; oid_ := old.id;
  else hh := new.household_id; oid_ := new.id;
  end if;
  insert into public.audit_events(household_id, actor_user_id, actor_type, action, object_type, object_id, changes)
  values (
    hh,
    (select auth.uid()),
    case when (select auth.uid()) is null then 'system' else 'user' end,
    tg_op, tg_table_name, oid_,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
  arr text[] := array['household_memberships','announcements','rides','events','maintenance_issues'];
begin
  foreach t in array arr loop
    execute format('create trigger trg_write_audit after insert or update or delete on public.%I for each row execute function app.write_audit();', t);
  end loop;
end $$;

-- 6. CHECK constraints.
alter table public.events add constraint events_timed_xor_allday
  check ( (starts_at is not null and all_day_start is null) or (starts_at is null and all_day_start is not null) );
alter table public.rides add constraint rides_depart_before_arrive
  check ( depart_by is null or arrive_by is null or depart_by <= arrive_by );
alter table public.meals add constraint meals_servings_nonneg
  check ( expected_servings is null or expected_servings >= 0 );
alter table public.recipes add constraint recipes_servings_nonneg
  check ( default_servings is null or default_servings >= 0 );
alter table public.inventory_items add constraint inventory_qty_nonneg
  check ( (quantity is null or quantity >= 0) and (reserved_quantity is null or reserved_quantity >= 0) and (min_quantity is null or min_quantity >= 0) );
alter table public.shopping_items add constraint shopping_qty_nonneg
  check ( quantity is null or quantity >= 0 );
alter table public.meal_responses add constraint meal_guest_count_nonneg
  check ( guest_count >= 0 );

-- Note: read paths must filter deleted_at is null (enforced in the app data layer,
-- not in RLS, so admin restore stays possible).
