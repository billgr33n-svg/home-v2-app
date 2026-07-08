-- 0003_m1_security_isolation
-- M1 household-isolation security model. Isolation-first per ADR-0010.
-- Deny-by-default is already in place (0002). This opens the minimum needed.
-- Proven green by supabase/tests/rls_isolation.sql.

create schema if not exists app;
grant usage on schema app to authenticated;

-- SECURITY DEFINER helpers. Owned by the migration role (which owns the tenant
-- tables and is therefore RLS-exempt on them), so membership lookups inside these
-- functions do not recurse through household_memberships policies.
create or replace function app.is_active_household_member(hh uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_memberships m
    where m.household_id = hh and m.user_id = (select auth.uid()) and m.state = 'active'
  );
$$;

create or replace function app.is_household_admin(hh uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_memberships m
    where m.household_id = hh and m.user_id = (select auth.uid())
      and m.state = 'active' and m.role = 'admin'
  );
$$;

create or replace function app.is_household_creator(hh uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.households h
    where h.id = hh and h.created_by = (select auth.uid())
  );
$$;

create or replace function app.shares_household_with(other_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.household_memberships me
    join public.household_memberships them on them.household_id = me.household_id
    where me.user_id = (select auth.uid()) and me.state = 'active'
      and them.user_id = other_user and them.state = 'active'
  );
$$;

revoke all on function app.is_active_household_member(uuid) from public;
revoke all on function app.is_household_admin(uuid) from public;
revoke all on function app.is_household_creator(uuid) from public;
revoke all on function app.shares_household_with(uuid) from public;
grant execute on function app.is_active_household_member(uuid) to authenticated;
grant execute on function app.is_household_admin(uuid) to authenticated;
grant execute on function app.is_household_creator(uuid) to authenticated;
grant execute on function app.shares_household_with(uuid) to authenticated;

-- households: members read; creator always reads their own; admins mutate.
create policy hh_select on public.households for select to authenticated
  using (app.is_active_household_member(id) or created_by = (select auth.uid()));
create policy hh_insert on public.households for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy hh_update on public.households for update to authenticated
  using (app.is_household_admin(id)) with check (app.is_household_admin(id));
create policy hh_delete on public.households for delete to authenticated
  using (app.is_household_admin(id));

-- household_memberships: see your own row or your households' rows; admins manage;
-- creator bootstraps their own admin row on a new household.
create policy hm_select on public.household_memberships for select to authenticated
  using (user_id = (select auth.uid()) or app.is_active_household_member(household_id));
create policy hm_insert on public.household_memberships for insert to authenticated
  with check (
    app.is_household_admin(household_id)
    or (user_id = (select auth.uid()) and app.is_household_creator(household_id))
  );
create policy hm_update on public.household_memberships for update to authenticated
  using (app.is_household_admin(household_id) or user_id = (select auth.uid()))
  with check (app.is_household_admin(household_id) or user_id = (select auth.uid()));
create policy hm_delete on public.household_memberships for delete to authenticated
  using (app.is_household_admin(household_id));

-- profiles: yourself and people who share a household with you.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or app.shares_household_with(id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Uniform household-scoped tables: member reads and writes own household's rows.
do $$
declare t text;
  uniform text[] := array[
    'properties','locations','events','rides','announcements','polls','recipes',
    'meals','inventory_items','shopping_items','tasks','home_assets',
    'maintenance_issues','service_records','attachments','comments'
  ];
begin
  foreach t in array uniform loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (app.is_active_household_member(household_id));', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (app.is_active_household_member(household_id));', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (app.is_active_household_member(household_id)) with check (app.is_active_household_member(household_id));', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (app.is_active_household_member(household_id));', t);
  end loop;
end $$;

-- Junction tables: derive the household from the parent row.
do $$
declare j record;
begin
  for j in
    select * from (values
      ('event_participants','events','event_id'),
      ('ride_passengers','rides','ride_id'),
      ('announcement_recipients','announcements','announcement_id'),
      ('poll_responses','polls','poll_id'),
      ('meal_responses','meals','meal_id')
    ) as x(child, parent, fk)
  loop
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated using (exists (select 1 from public.%2$I p where p.id = %1$I.%3$I and app.is_active_household_member(p.household_id)));',
      j.child, j.parent, j.fk);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated with check (exists (select 1 from public.%2$I p where p.id = %3$I and app.is_active_household_member(p.household_id)));',
      j.child, j.parent, j.fk);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated using (exists (select 1 from public.%2$I p where p.id = %1$I.%3$I and app.is_active_household_member(p.household_id))) with check (exists (select 1 from public.%2$I p where p.id = %1$I.%3$I and app.is_active_household_member(p.household_id)));',
      j.child, j.parent, j.fk);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated using (exists (select 1 from public.%2$I p where p.id = %1$I.%3$I and app.is_active_household_member(p.household_id)));',
      j.child, j.parent, j.fk);
  end loop;
end $$;

-- notifications: user-scoped. Client reads/acks own; server (service_role) inserts.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- audit_events: household admins read; writes only via server/controlled functions.
create policy audit_select on public.audit_events for select to authenticated
  using (app.is_household_admin(household_id));

-- calendar_connections intentionally gets NO authenticated policy: it holds
-- credential_ref and stays server-only (ADR-0002, docs/04 section 8).
