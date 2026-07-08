-- 0007_auth_tenancy_flows
-- Profile auto-creation, invite tokens, and the create/join household RPCs.
-- Verified end to end: signup->profile, create_household->admin membership,
-- admin invite, accept_invite->join, with isolation preserved for the new household.

-- Auto-create a profile row when an auth user is created.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- Invite tokens. Only household admins manage them; invitees never read them
-- directly (they call accept_invite with the token).
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token text not null unique default gen_random_uuid()::text,
  role member_role not null default 'adult',
  invited_email citext,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.household_invites(household_id);
alter table public.household_invites enable row level security;
create policy invites_admin_all on public.household_invites for all to authenticated
  using (app.is_household_admin(household_id))
  with check (app.is_household_admin(household_id));

-- Create a household and make the caller its admin, atomically.
create or replace function public.create_household(p_name text, p_timezone text default 'America/Chicago')
returns public.households
language plpgsql security invoker set search_path = '' as $$
declare hh public.households;
begin
  insert into public.households (name, timezone, created_by)
  values (p_name, p_timezone, (select auth.uid()))
  returning * into hh;
  insert into public.household_memberships (household_id, user_id, role, state)
  values (hh.id, (select auth.uid()), 'admin', 'active');
  return hh;
end $$;

-- Accept an invite by token. SECURITY DEFINER so a not-yet-member can join.
create or replace function public.accept_invite(p_token text)
returns public.household_memberships
language plpgsql security definer set search_path = '' as $$
declare inv public.household_invites; mem public.household_memberships;
begin
  select * into inv from public.household_invites where token = p_token;
  if inv.id is null then raise exception 'invalid invite'; end if;
  if inv.accepted_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  insert into public.household_memberships (household_id, user_id, role, state)
  values (inv.household_id, (select auth.uid()), inv.role, 'active')
  on conflict (household_id, user_id) do update set state = 'active', role = excluded.role
  returning * into mem;
  update public.household_invites set accepted_at = now(), accepted_by = (select auth.uid()) where id = inv.id;
  return mem;
end $$;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;