-- 0023_lock_calendar_connections.sql
-- calendar_connections is server-only, so say it in grants, not just in RLS.
--
-- RLS is enabled with zero policies, which already denies anon and authenticated.
-- But this is the table about to hold Google refresh-token pointers, and "the
-- only thing between anon and the credential is the absence of a policy" is not a
-- sentence anyone should have to write. Migration 0021 skipped it on the
-- reasoning that it was "already locked". Belt and braces.
--
-- Only service_role (the OAuth Edge Functions) touches this table. The client
-- reads it exclusively through `my_calendar_connections()` (migration 0024).

revoke all on public.calendar_connections from anon;
revoke all on public.calendar_connections from authenticated;

comment on table public.calendar_connections is
  'Server-only. RLS on, zero policies, no anon/authenticated grants. Written exclusively by the OAuth Edge Functions under service_role.';
comment on column public.calendar_connections.credential_ref is
  'Pointer into Supabase Vault (vault.secrets), NOT the token itself. The refresh token never lands in a public-schema column.';

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- (Re-granting would re-expose the table. Do not, unless a genuinely
--  client-facing surface appears -- and then add RLS policies, not grants.)
