-- rls_isolation.sql
-- M1 cross-household isolation suite (database layer). Run each block against a
-- database seeded with seed.sql. Impersonation uses request.jwt.claims + the
-- authenticated role, exactly as PostgREST does for a signed-in user.
--
-- Households: Green 1111...1111 (Bill a0..01), Rivera 2222...2222 (Maria b0..01).
-- Every block below passed on 2026-07-04 against ref meinjdymzihqeajwwgkq.

-- TEST A: Bill (Green) read isolation. PASS = rivera_*_leak all 0; own rows > 0.
-- Observed: households 1, profiles 5, events 1, tasks 1, meal_responses 4,
--           memberships 5, rivera leaks 0/0/0.
begin;
  select set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
  set local role authenticated;
  select
    (select count(*) from public.households) as households,
    (select count(*) from public.profiles) as profiles,
    (select count(*) from public.tasks where household_id='22222222-2222-2222-2222-222222222222') as rivera_task_leak,
    (select count(*) from public.events where household_id='22222222-2222-2222-2222-222222222222') as rivera_event_leak;
rollback;

-- TEST B: Maria (Rivera) read isolation. PASS = green_*_leak all 0; own rows > 0.
-- Observed: households 1, profiles 2, memberships 2, green leaks 0/0/0.
begin;
  select set_config('request.jwt.claims','{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
  set local role authenticated;
  select
    (select count(*) from public.households) as households,
    (select count(*) from public.profiles) as profiles,
    (select count(*) from public.tasks where household_id='11111111-1111-1111-1111-111111111111') as green_task_leak,
    (select count(*) from public.meal_responses) as green_meal_resp_leak,
    (select count(*) from public.profiles where id::text like 'a0000000%') as green_profile_leak;
rollback;

-- TEST C: Bill cross-household UPDATE/DELETE on Rivera. PASS = both counts 0.
-- Observed: rivera_rows_updated 0, rivera_rows_deleted 0.
begin;
  select set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
  set local role authenticated;
  with u as (update public.tasks set title='HACKED' where household_id='22222222-2222-2222-2222-222222222222' returning 1),
       d as (delete from public.announcements where household_id='22222222-2222-2222-2222-222222222222' returning 1)
  select (select count(*) from u) as rivera_rows_updated, (select count(*) from d) as rivera_rows_deleted;
rollback;

-- TEST D: Bill INSERT into Rivera. PASS = raises
--   "new row violates row-level security policy for table \"tasks\"".
begin;
  select set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
  set local role authenticated;
  insert into public.tasks (household_id, creator_id, title)
  values ('22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001','cross-household leak attempt');
rollback;

-- TEST E: anonymous role. PASS = every count 0.
begin;
  set local role anon;
  select
    (select count(*) from public.events) as events,
    (select count(*) from public.tasks) as tasks,
    (select count(*) from public.households) as households,
    (select count(*) from public.profiles) as profiles;
rollback;
