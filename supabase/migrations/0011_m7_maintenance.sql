-- 0011_m7_maintenance.sql
-- M7: recurring maintenance schedules on home assets, producing due reminders.
--
-- maintenance_schedules attaches a cadence (in days) to a home_asset and tracks
-- next_due_on. complete_maintenance advances next_due_on by the cadence. RLS is
-- the standard household-isolation posture; a guard trigger keeps the schedule's
-- asset in the same household. Rollback at the bottom.

create table if not exists public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  asset_id uuid not null references public.home_assets(id) on delete cascade,
  title text not null,
  cadence_days int not null,
  last_done_on date,
  next_due_on date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ms_cadence_positive check (cadence_days > 0)
);

create index if not exists ms_household_idx on public.maintenance_schedules(household_id);
create index if not exists ms_asset_idx on public.maintenance_schedules(asset_id);
create index if not exists ms_due_idx on public.maintenance_schedules(next_due_on);

grant select, insert, update, delete on public.maintenance_schedules to authenticated;

create or replace function app.ms_guard() returns trigger language plpgsql set search_path = '' as $$
declare ah uuid;
begin
  select household_id into ah from public.home_assets where id = new.asset_id;
  if ah is null or ah <> new.household_id then
    raise exception 'schedule asset must belong to the schedule household';
  end if;
  return new;
end $$;

create trigger trg_ms_guard before insert or update on public.maintenance_schedules
  for each row execute function app.ms_guard();

create trigger trg_touch_updated_at before update on public.maintenance_schedules
  for each row execute function app.touch_updated_at();

alter table public.maintenance_schedules enable row level security;

create policy ms_select on public.maintenance_schedules for select to authenticated
  using (app.is_active_household_member(household_id));
create policy ms_insert on public.maintenance_schedules for insert to authenticated
  with check (app.is_active_household_member(household_id));
create policy ms_update on public.maintenance_schedules for update to authenticated
  using (app.is_active_household_member(household_id))
  with check (app.is_active_household_member(household_id));
create policy ms_delete on public.maintenance_schedules for delete to authenticated
  using (app.is_active_household_member(household_id));

-- Mark a maintenance task done: stamp today and advance next_due_on by cadence.
create or replace function public.complete_maintenance(p_schedule_id uuid)
returns public.maintenance_schedules language plpgsql security invoker set search_path = '' as $$
declare s public.maintenance_schedules;
begin
  update public.maintenance_schedules
    set last_done_on = current_date, next_due_on = current_date + cadence_days
    where id = p_schedule_id
    returning * into s;
  if s.id is null then raise exception 'schedule not found or not permitted'; end if;
  return s;
end $$;

grant execute on function public.complete_maintenance(uuid) to authenticated;

-- ROLLBACK --------------------------------------------------------------------
-- drop function if exists public.complete_maintenance(uuid);
-- drop trigger if exists trg_touch_updated_at on public.maintenance_schedules;
-- drop trigger if exists trg_ms_guard on public.maintenance_schedules;
-- drop table if exists public.maintenance_schedules;
-- drop function if exists app.ms_guard();
