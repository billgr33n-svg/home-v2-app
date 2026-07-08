-- 0008_ride_coordination
-- Last-mile ride updates/escalation + race-safe claim/close via version columns (ADR-0008).
-- Verified via SQL: stale re-claim rejected, cross-household claim/post blocked, escalation posts.

create table public.ride_updates (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete restrict,
  author_id uuid not null references public.profiles(id),
  kind text not null default 'update' check (kind in ('update','escalation')),
  note text not null,
  created_at timestamptz not null default now()
);
create index on public.ride_updates(ride_id, created_at);
alter table public.ride_updates enable row level security;

create policy ride_updates_select on public.ride_updates for select to authenticated
  using (app.is_active_household_member(household_id));
create policy ride_updates_insert on public.ride_updates for insert to authenticated
  with check (app.is_active_household_member(household_id) and author_id = (select auth.uid()));

-- Race-safe driver claim. The version-bump trigger makes the conditional update an
-- optimistic lock: two simultaneous claims read version N; the first wins and bumps
-- to N+1, the second's WHERE no longer matches.
create or replace function public.claim_ride(p_ride_id uuid, p_expected_version int)
returns public.rides language plpgsql security invoker set search_path = '' as $$
declare r public.rides;
begin
  update public.rides set driver_id = (select auth.uid()), state = 'assigned'
    where id = p_ride_id and version = p_expected_version and driver_id is null
    returning * into r;
  if r.id is null then raise exception 'ride unavailable or already changed'; end if;
  return r;
end $$;

-- Race-safe poll close.
create or replace function public.close_poll(p_poll_id uuid, p_expected_version int, p_decision jsonb)
returns public.polls language plpgsql security invoker set search_path = '' as $$
declare p public.polls;
begin
  update public.polls set closed_at = now(), final_decision = p_decision
    where id = p_poll_id and version = p_expected_version and closed_at is null
    returning * into p;
  if p.id is null then raise exception 'poll already closed or changed'; end if;
  return p;
end $$;

-- Post a ride update or escalation. Derives household from the ride (which the
-- caller can only see if they are a member), preventing cross-household posts.
create or replace function public.post_ride_update(p_ride_id uuid, p_kind text, p_note text)
returns public.ride_updates language plpgsql security invoker set search_path = '' as $$
declare u public.ride_updates; hh uuid;
begin
  select household_id into hh from public.rides where id = p_ride_id;
  if hh is null then raise exception 'ride not found'; end if;
  insert into public.ride_updates (ride_id, household_id, author_id, kind, note)
  values (p_ride_id, hh, (select auth.uid()), coalesce(p_kind, 'update'), p_note)
  returning * into u;
  return u;
end $$;

grant execute on function public.claim_ride(uuid, int) to authenticated;
grant execute on function public.close_poll(uuid, int, jsonb) to authenticated;
grant execute on function public.post_ride_update(uuid, text, text) to authenticated;
