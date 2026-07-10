-- 0024_google_calendar_oauth.sql
-- The database side of the Google Calendar connection.
--
-- Three pieces:
--   1. `oauth_states`  -- single-use CSRF tokens for the authorization handshake
--   2. `calendar_connections` gains a sync cursor and an error field
--   3. `my_calendar_connections()` -- the ONLY way the client sees a connection
--
-- THE REFRESH TOKEN NEVER LANDS IN A PUBLIC-SCHEMA COLUMN.
--
-- It goes into Supabase Vault. `calendar_connections.credential_ref` holds the
-- vault secret's UUID, nothing more. The vault's `decrypted_secrets` view is
-- readable only by `service_role`, which only the Edge Functions hold. Migration
-- 0023 already stripped `anon` and `authenticated` grants from the table itself.
--
-- WHY `oauth_states` EXISTS AT ALL
--
-- `google-calendar-callback` is the one endpoint in this system that Google's
-- browser redirect must reach without a JWT. `verify_jwt` is therefore off, and
-- the entire security of that endpoint rests on the `state` parameter: a 32-byte
-- random token, stored here before the redirect, single-use, ten-minute expiry,
-- bound to one household and one user.
--
-- Without it, anyone who guessed the function URL could hand us an authorization
-- code and attach *their* Google account to *Bill's* household. That is why
-- `consumed_at` is set inside the same statement that reads the row, and why the
-- expiry is short.
--
-- Rollback at the bottom.

-- ---------------------------------------------------------------------------
-- 1. Single-use authorization state
-- ---------------------------------------------------------------------------
create table if not exists public.oauth_states (
  state        text primary key,
  provider     text not null default 'google' check (provider = 'google'),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '10 minutes',
  consumed_at  timestamptz
);

comment on table public.oauth_states is
  'Single-use CSRF tokens for the OAuth handshake. Server-only: RLS on, zero policies, zero grants. The callback Edge Function runs without a JWT, so this table is the whole of its authentication.';

alter table public.oauth_states enable row level security;
revoke all on public.oauth_states from anon;
revoke all on public.oauth_states from authenticated;

create index if not exists oauth_states_expiry_idx on public.oauth_states (expires_at);

-- Consume a state token exactly once. Returns the row only on the first call.
-- The UPDATE ... RETURNING is the check and the burn in one statement, so two
-- concurrent callbacks cannot both succeed.
create or replace function public.consume_oauth_state(p_state text)
returns table (household_id uuid, user_id uuid)
language sql
security definer
set search_path = ''
as $$
  update public.oauth_states
     set consumed_at = now()
   where state = p_state
     and consumed_at is null
     and expires_at > now()
  returning household_id, user_id;
$$;

revoke all on function public.consume_oauth_state(text) from public, anon, authenticated;
-- service_role only: the callback function is the sole caller.
grant execute on function public.consume_oauth_state(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Connection bookkeeping
-- ---------------------------------------------------------------------------
alter table public.calendar_connections
  add column if not exists last_error text,
  add column if not exists revoked_at timestamptz;

comment on column public.calendar_connections.last_error is
  'Last sync failure, in plain language. NULL when the last sync worked.';
comment on column public.calendar_connections.sync_state is
  'Google incremental-sync cursors: {"syncTokens": {"<calendarId>": "<token>"}}. A 410 Gone means the token expired; drop it and full-sync that calendar.';

-- One connection per person per provider per household. Makes the callback an upsert.
create unique index if not exists calendar_connections_owner_uniq
  on public.calendar_connections (household_id, user_id, provider);

-- ---------------------------------------------------------------------------
-- 3. What the client is allowed to know
--
-- The table has no policies and no grants, so the app cannot select from it.
-- This function is the whole API: it returns a person's own connections, and it
-- never returns `credential_ref`. Filtering on auth.uid() inside a SECURITY
-- DEFINER function is what makes that safe.
-- ---------------------------------------------------------------------------
create or replace function public.my_calendar_connections()
returns table (
  id                  uuid,
  household_id        uuid,
  provider            text,
  external_account_id text,
  share_mode          text,
  last_synced_at      timestamptz,
  last_error          text,
  created_at          timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select c.id, c.household_id, c.provider, c.external_account_id, c.share_mode,
         c.last_synced_at, c.last_error, c.created_at
    from public.calendar_connections c
   where c.user_id = (select auth.uid())
     and c.revoked_at is null;
$$;

comment on function public.my_calendar_connections() is
  'A person''s own calendar connections. Never returns credential_ref. The only client-visible window onto a server-only table.';

revoke all on function public.my_calendar_connections() from public, anon;
grant execute on function public.my_calendar_connections() to authenticated;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- drop function if exists public.my_calendar_connections();
-- drop function if exists public.consume_oauth_state(text);
-- drop index if exists public.calendar_connections_owner_uniq;
-- alter table public.calendar_connections drop column if exists last_error, drop column if exists revoked_at;
-- drop table if exists public.oauth_states;
