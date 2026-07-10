-- 0022_kitchen_shifts.sql
-- The weekly kitchen signup.
--
-- Four roles a day, plus three fridge clean-outs a week. Slots start EMPTY and
-- people claim them (Bill's choice, 2026-07-10). Nobody is pre-assigned.
--
-- DESIGN NOTES
--
-- 1. WHY NOT `tasks`. Tasks already have race-safe claim/complete and recurrence,
--    and reusing them would have been free. But "PM Cleanup - Helper" is not a
--    task, it is a ROLE, and encoding a role in a title string means every query
--    about "who leads cleanup most often" becomes a LIKE against prose. The whole
--    point of this table is to answer that question.
--
-- 2. WHY `original_claimed_by`. An open-signup board with a plain `claimed_by`
--    cannot tell you that Cora claimed Thursday four weeks running and handed it
--    off every time. The first claimant is remembered; whoever ends up holding
--    the slot is `claimed_by`. `covered` falls out of the difference. This is the
--    only column here that speaks to the project's actual thesis -- whether the
--    load is shared -- so it is not optional.
--
-- 3. WHY OPTIMISTIC CONCURRENCY (ADR-0008). Two people tapping "I'll do it" on
--    the same slot in the same second is the normal case for a signup board, not
--    an edge case. Every mutation takes the version it saw and loses the race
--    loudly rather than silently overwriting.
--
-- 4. THE FRIDGE SCHEDULE IS THE HOUSEHOLD'S, NOT A LAW. Kitchen on Wednesday,
--    Garage on Friday, Basement on Saturday -- taken from Bill's grid. It lives
--    in `ensure_kitchen_week()` and is one edit away from changing.
--
-- 5. `week_start` IS ALWAYS A MONDAY, enforced by CHECK. A rota that silently
--    disagrees with itself about where the week begins is a rota nobody trusts.
--
-- Rollback at the bottom.

create type public.kitchen_role as enum ('am_unload', 'pm_lead', 'pm_helper', 'pm_wipe', 'fridge');

create table if not exists public.kitchen_shifts (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households(id) on delete restrict,
  week_start          date not null,
  shift_date          date not null,
  role                public.kitchen_role not null,
  -- 'Kitchen' | 'Garage' | 'Basement' for a fridge duty; null for the daily roles.
  detail              text,

  claimed_by          uuid references public.profiles(id),
  claimed_at          timestamptz,
  -- Whoever first put their name down. Survives a hand-off.
  original_claimed_by uuid references public.profiles(id),

  completed_by        uuid references public.profiles(id),
  completed_at        timestamptz,
  skipped_at          timestamptz,

  version             int not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  constraint ks_week_starts_monday check (extract(isodow from week_start) = 1),
  constraint ks_date_in_week check (shift_date >= week_start and shift_date < week_start + 7),
  constraint ks_fridge_has_location check (
    (role = 'fridge' and detail is not null) or (role <> 'fridge' and detail is null)
  ),
  constraint ks_completed_is_claimed check (completed_at is null or claimed_by is not null)
);

comment on table public.kitchen_shifts is
  'One claimable kitchen slot. Empty by default; people sign up. original_claimed_by remembers who was covered for.';
comment on column public.kitchen_shifts.original_claimed_by is
  'The first person to claim this slot. If claimed_by differs, someone is covering for them. This is the load-sharing signal.';

-- One slot per (day, role, location). Soft-deleted rows release the slot.
create unique index if not exists kitchen_shifts_slot_uniq
  on public.kitchen_shifts (household_id, shift_date, role, coalesce(detail, ''))
  where deleted_at is null;

create index if not exists kitchen_shifts_week_idx
  on public.kitchen_shifts (household_id, week_start)
  where deleted_at is null;

drop trigger if exists trg_kitchen_touch on public.kitchen_shifts;
create trigger trg_kitchen_touch
  before update on public.kitchen_shifts
  for each row execute function app.touch_updated_at();

drop trigger if exists trg_kitchen_version on public.kitchen_shifts;
create trigger trg_kitchen_version
  before update on public.kitchen_shifts
  for each row execute function app.bump_version();

revoke all on public.kitchen_shifts from anon;
grant select, insert, update on public.kitchen_shifts to authenticated;

alter table public.kitchen_shifts enable row level security;

drop policy if exists ks_select on public.kitchen_shifts;
create policy ks_select on public.kitchen_shifts
  for select to authenticated using (app.is_active_household_member(household_id));

drop policy if exists ks_insert on public.kitchen_shifts;
create policy ks_insert on public.kitchen_shifts
  for insert to authenticated with check (app.is_active_household_member(household_id));

drop policy if exists ks_update on public.kitchen_shifts;
create policy ks_update on public.kitchen_shifts
  for update to authenticated
  using (app.is_active_household_member(household_id))
  with check (app.is_active_household_member(household_id));

-- ---------------------------------------------------------------------------
-- ensure_kitchen_week: materialise an empty board for a week. Idempotent.
--
-- 7 days x 4 daily roles + 3 fridge duties = 31 slots. Running it twice adds
-- nothing (the unique index does the work), so the app can call it on every
-- week navigation without thinking.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_kitchen_week(p_household uuid, p_week_start date)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before int;
  v_after  int;
begin
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday, got %', p_week_start;
  end if;

  select count(*) into v_before from public.kitchen_shifts
   where household_id = p_household and week_start = p_week_start and deleted_at is null;

  -- The four daily roles, every day of the week.
  insert into public.kitchen_shifts (household_id, week_start, shift_date, role)
  select p_household, p_week_start, p_week_start + d, r
    from generate_series(0, 6) as d,
         unnest(array['am_unload','pm_lead','pm_helper','pm_wipe']::public.kitchen_role[]) as r
  on conflict do nothing;

  -- The household's fridge cadence: Kitchen Wed, Garage Fri, Basement Sat.
  insert into public.kitchen_shifts (household_id, week_start, shift_date, role, detail)
  values
    (p_household, p_week_start, p_week_start + 2, 'fridge', 'Kitchen'),
    (p_household, p_week_start, p_week_start + 4, 'fridge', 'Garage'),
    (p_household, p_week_start, p_week_start + 5, 'fridge', 'Basement')
  on conflict do nothing;

  select count(*) into v_after from public.kitchen_shifts
   where household_id = p_household and week_start = p_week_start and deleted_at is null;

  return v_after - v_before;
end $$;

-- ---------------------------------------------------------------------------
-- claim_shift: put your name down. Loses the race loudly.
-- ---------------------------------------------------------------------------
create or replace function public.claim_shift(p_shift uuid, p_expected_version int)
returns public.kitchen_shifts
language plpgsql
security invoker
set search_path = ''
as $$
declare s public.kitchen_shifts;
begin
  update public.kitchen_shifts
     set claimed_by = (select auth.uid()),
         claimed_at = now(),
         -- Remembered once, then never overwritten: this is who is being covered for.
         original_claimed_by = coalesce(original_claimed_by, (select auth.uid())),
         skipped_at = null
   where id = p_shift
     and version = p_expected_version
     and claimed_by is null
     and completed_at is null
     and deleted_at is null
   returning * into s;

  if s.id is null then raise exception 'shift unavailable or already claimed'; end if;
  return s;
end $$;

-- ---------------------------------------------------------------------------
-- release_shift: give it up. `original_claimed_by` survives, so the next person
-- to claim it is visibly covering for you.
-- ---------------------------------------------------------------------------
create or replace function public.release_shift(p_shift uuid, p_expected_version int)
returns public.kitchen_shifts
language plpgsql
security invoker
set search_path = ''
as $$
declare s public.kitchen_shifts;
begin
  update public.kitchen_shifts
     set claimed_by = null,
         claimed_at = null
   where id = p_shift
     and version = p_expected_version
     and claimed_by = (select auth.uid())
     and completed_at is null
     and deleted_at is null
   returning * into s;

  if s.id is null then raise exception 'not yours to release, or already done'; end if;
  return s;
end $$;

-- ---------------------------------------------------------------------------
-- cover_shift: hand a slot directly to someone. Any member may do this, because
-- "Cora, can you take Thursday?" happens out loud and whoever is holding the
-- phone types it in.
-- ---------------------------------------------------------------------------
create or replace function public.cover_shift(p_shift uuid, p_user uuid, p_expected_version int)
returns public.kitchen_shifts
language plpgsql
security invoker
set search_path = ''
as $$
declare s public.kitchen_shifts; hh uuid;
begin
  select household_id into hh from public.kitchen_shifts where id = p_shift and deleted_at is null;
  if hh is null then raise exception 'shift not found'; end if;

  -- You cannot hand a slot to someone who does not live here.
  if not exists (
    select 1 from public.household_memberships m
     where m.household_id = hh and m.user_id = p_user and m.state = 'active'
  ) then
    raise exception 'that person is not an active member of this household';
  end if;

  update public.kitchen_shifts
     set claimed_by = p_user,
         claimed_at = now(),
         original_claimed_by = coalesce(original_claimed_by, p_user),
         skipped_at = null
   where id = p_shift
     and version = p_expected_version
     and completed_at is null
     and deleted_at is null
   returning * into s;

  if s.id is null then raise exception 'shift changed under you, or already done'; end if;
  return s;
end $$;

-- ---------------------------------------------------------------------------
-- complete_shift / skip_shift
-- ---------------------------------------------------------------------------
create or replace function public.complete_shift(p_shift uuid, p_expected_version int)
returns public.kitchen_shifts
language plpgsql
security invoker
set search_path = ''
as $$
declare s public.kitchen_shifts;
begin
  update public.kitchen_shifts
     set completed_at = now(),
         completed_by = (select auth.uid())
   where id = p_shift
     and version = p_expected_version
     and claimed_by is not null
     and completed_at is null
     and deleted_at is null
   returning * into s;

  if s.id is null then raise exception 'nothing to complete: unclaimed, already done, or changed'; end if;
  return s;
end $$;

create or replace function public.skip_shift(p_shift uuid, p_expected_version int)
returns public.kitchen_shifts
language plpgsql
security invoker
set search_path = ''
as $$
declare s public.kitchen_shifts;
begin
  update public.kitchen_shifts
     set skipped_at = now()
   where id = p_shift
     and version = p_expected_version
     and completed_at is null
     and deleted_at is null
   returning * into s;

  if s.id is null then raise exception 'shift changed under you'; end if;
  return s;
end $$;

-- ---------------------------------------------------------------------------
-- copy_kitchen_week: prefill from another week.
--
-- Open signup means an empty board every Monday, and an empty board on Sunday
-- night means nobody unloads on Monday. This is the escape hatch: copy who did
-- what last week, then let people adjust. Copied names become the ORIGINAL
-- claimant, because that is exactly who is on the hook until someone covers.
-- Only fills slots that are currently empty; never overwrites a real claim.
-- ---------------------------------------------------------------------------
create or replace function public.copy_kitchen_week(p_household uuid, p_from date, p_to date)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare v_filled int;
begin
  perform public.ensure_kitchen_week(p_household, p_to);

  with src as (
    select role, detail, claimed_by, shift_date - week_start as day_offset
      from public.kitchen_shifts
     where household_id = p_household and week_start = p_from
       and deleted_at is null and claimed_by is not null
  )
  update public.kitchen_shifts dst
     set claimed_by = src.claimed_by,
         claimed_at = now(),
         original_claimed_by = coalesce(dst.original_claimed_by, src.claimed_by)
    from src
   where dst.household_id = p_household
     and dst.week_start = p_to
     and dst.deleted_at is null
     and dst.claimed_by is null
     and dst.completed_at is null
     and dst.role = src.role
     and coalesce(dst.detail, '') = coalesce(src.detail, '')
     and dst.shift_date = p_to + src.day_offset;

  get diagnostics v_filled = row_count;
  return v_filled;
end $$;

revoke all on function public.ensure_kitchen_week(uuid, date) from public, anon;
revoke all on function public.claim_shift(uuid, int) from public, anon;
revoke all on function public.release_shift(uuid, int) from public, anon;
revoke all on function public.cover_shift(uuid, uuid, int) from public, anon;
revoke all on function public.complete_shift(uuid, int) from public, anon;
revoke all on function public.skip_shift(uuid, int) from public, anon;
revoke all on function public.copy_kitchen_week(uuid, date, date) from public, anon;

grant execute on function public.ensure_kitchen_week(uuid, date) to authenticated;
grant execute on function public.claim_shift(uuid, int) to authenticated;
grant execute on function public.release_shift(uuid, int) to authenticated;
grant execute on function public.cover_shift(uuid, uuid, int) to authenticated;
grant execute on function public.complete_shift(uuid, int) to authenticated;
grant execute on function public.skip_shift(uuid, int) to authenticated;
grant execute on function public.copy_kitchen_week(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- drop function if exists public.copy_kitchen_week(uuid, date, date);
-- drop function if exists public.skip_shift(uuid, int);
-- drop function if exists public.complete_shift(uuid, int);
-- drop function if exists public.cover_shift(uuid, uuid, int);
-- drop function if exists public.release_shift(uuid, int);
-- drop function if exists public.claim_shift(uuid, int);
-- drop function if exists public.ensure_kitchen_week(uuid, date);
-- drop table if exists public.kitchen_shifts;
-- drop type if exists public.kitchen_role;
