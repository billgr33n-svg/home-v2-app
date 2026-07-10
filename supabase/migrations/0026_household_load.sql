-- 0026_household_load.sql
-- Instrumenting the thesis.
--
-- HOME_V2_PROJECT_SPEC claims that structured family coordination measurably
-- reduces the household administrator's mental load. Nothing in this system has
-- ever measured that. Sandy joining is the last moment a baseline can be taken,
-- so it is taken now.
--
-- THE DISTINCTION THAT MAKES THIS HONEST
--
--   INITIATION is mental load. Noticing the milk is low. Remembering the filter.
--   Deciding someone must drive Cora on Thursday. Typing it in.
--
--   EXECUTION is labour. Doing the thing that was already decided.
--
-- These are not the same, and conflating them is how a household coordination
-- app flatters itself. If Bill still creates 90% of the rows and everyone else
-- merely completes them, Bill's mental load is UNCHANGED -- he is still the one
-- holding the whole house in his head. The number to watch is the initiator
-- share, not the completion count.
--
-- WHAT IS COUNTED, AND WHAT IS NOT
--
-- Only actions with a real actor AND a real timestamp. Several tables record a
-- terminal state (`tasks.state = 'completed'`, `rides.state = 'completed'`) but
-- no completion timestamp, so attributing them to a week would mean inventing
-- one. They are omitted rather than guessed. This under-counts execution, which
-- is the safe direction: it makes the app look worse than it is, never better.
--
-- SECURITY INVOKER on purpose: every underlying table is behind household RLS,
-- so a member sees their own household and nothing else.
--
-- Rollback at the bottom.

-- ---------------------------------------------------------------------------
-- Who started things, and who finished them.
-- ---------------------------------------------------------------------------
create or replace function public.household_load(
  p_household uuid,
  p_from timestamptz,
  p_to   timestamptz default now()
)
returns table (
  user_id   uuid,
  name      text,
  initiated int,
  executed  int
)
language sql
security invoker
stable
set search_path = ''
as $$
  with initiated as (
    select creator_id   as actor from public.tasks              where household_id=p_household and deleted_at is null and created_at >= p_from and created_at < p_to
    union all
    select created_by          from public.meals               where household_id=p_household and deleted_at is null and created_at >= p_from and created_at < p_to
    union all
    select requester_id        from public.shopping_items      where household_id=p_household and deleted_at is null and created_at >= p_from and created_at < p_to
    union all
    select requester_id        from public.rides               where household_id=p_household and deleted_at is null and created_at >= p_from and created_at < p_to
    union all
    select author_id           from public.announcements       where household_id=p_household and deleted_at is null and created_at >= p_from and created_at < p_to
    union all
    select creator_id          from public.polls               where household_id=p_household and deleted_at is null and created_at >= p_from and created_at < p_to
    union all
    select reporter_id         from public.maintenance_issues  where household_id=p_household and deleted_at is null and created_at >= p_from and created_at < p_to
  ),
  executed as (
    -- Only where an actor and a completion time both genuinely exist.
    select completed_by as actor from public.kitchen_shifts
      where household_id=p_household and deleted_at is null and completed_at >= p_from and completed_at < p_to
    union all
    select claimed_by from public.shopping_items
      where household_id=p_household and deleted_at is null and state='completed'
        and completed_at >= p_from and completed_at < p_to
    union all
    select created_by from public.inventory_movements
      where household_id=p_household and created_at >= p_from and created_at < p_to
  ),
  people as (
    select m.user_id, p.display_name
      from public.household_memberships m
      join public.profiles p on p.id = m.user_id
     where m.household_id = p_household and m.state = 'active'
  )
  select people.user_id,
         people.display_name,
         (select count(*) from initiated i where i.actor = people.user_id)::int,
         (select count(*) from executed  e where e.actor = people.user_id)::int
    from people
   order by 3 desc, 2;
$$;

comment on function public.household_load(uuid, timestamptz, timestamptz) is
  'Per member: things they started (mental load) and things they finished (labour). Initiation is the number that tests the thesis.';

-- ---------------------------------------------------------------------------
-- What is sitting on nobody. This is load in its purest form: a decision the
-- administrator is still carrying because the system has not placed it anywhere.
-- ---------------------------------------------------------------------------
create or replace function public.household_unassigned(p_household uuid)
returns table (kind text, count int)
language sql
security invoker
stable
set search_path = ''
as $$
  select 'tasks with no owner', count(*)::int from public.tasks
    where household_id=p_household and deleted_at is null and owner_id is null
      and state not in ('completed','verified','canceled','skipped')
  union all
  select 'rides with no driver', count(*)::int from public.rides
    where household_id=p_household and deleted_at is null and driver_id is null
      and state not in ('completed','canceled')
  union all
  select 'meals with no cook', count(*)::int from public.meals
    where household_id=p_household and deleted_at is null and prep_owner_id is null
      and status in ('planned','requested')
  union all
  select 'kitchen slots unclaimed (this week)', count(*)::int from public.kitchen_shifts
    where household_id=p_household and deleted_at is null and claimed_by is null
      and completed_at is null
      and week_start = (current_date - ((extract(isodow from current_date)::int - 1)))
  union all
  select 'maintenance issues with no owner', count(*)::int from public.maintenance_issues
    where household_id=p_household and deleted_at is null and owner_id is null
      and state not in ('resolved','closed','canceled');
$$;

comment on function public.household_unassigned(uuid) is
  'Decisions nobody has taken. The administrator is holding every one of these in their head.';

revoke all on function public.household_load(uuid, timestamptz, timestamptz) from public;
revoke all on function public.household_load(uuid, timestamptz, timestamptz) from anon;
grant execute on function public.household_load(uuid, timestamptz, timestamptz) to authenticated;

revoke all on function public.household_unassigned(uuid) from public;
revoke all on function public.household_unassigned(uuid) from anon;
grant execute on function public.household_unassigned(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- drop function if exists public.household_unassigned(uuid);
-- drop function if exists public.household_load(uuid, timestamptz, timestamptz);
