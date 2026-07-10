-- 0025_vault_wrappers.sql
-- Two thin wrappers so an Edge Function can put a refresh token into Supabase
-- Vault and get it back out again.
--
-- `vault.create_secret` and `vault.decrypted_secrets` are not reachable through
-- PostgREST, so the Edge Functions cannot call them directly. These wrappers are
-- the bridge, and they are granted to `service_role` and to nothing else.
--
-- READ THIS BEFORE ADDING A GRANT:
--
--   `vault_read_secret` returns a Google refresh token in plaintext. A single
--   `grant execute ... to authenticated` on it would hand every signed-in family
--   member the keys to every other member's Google account. There is no RLS on a
--   function's return value. The grant IS the security boundary.
--
-- Rollback at the bottom.

create or replace function public.vault_upsert_secret(p_name text, p_secret text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;

  if v_id is null then
    v_id := vault.create_secret(p_secret, p_name, 'Google Calendar refresh token');
  else
    -- Re-consenting issues a new refresh token; the old one keeps working until
    -- revoked, but we only ever want to hold the newest.
    perform vault.update_secret(v_id, p_secret, p_name, 'Google Calendar refresh token');
  end if;

  return v_id;
end $$;

comment on function public.vault_upsert_secret(text, text) is
  'Store a credential in Supabase Vault, keyed by name. service_role only. Never grant to authenticated.';

create or replace function public.vault_read_secret(p_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_id;
$$;

comment on function public.vault_read_secret(uuid) is
  'Return a decrypted credential. service_role ONLY -- this returns a Google refresh token in plaintext. Granting it to `authenticated` would expose every member''s Google account to every other member.';

create or replace function public.vault_delete_secret(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from vault.secrets where id = p_id;
$$;

comment on function public.vault_delete_secret(uuid) is
  'Forget a credential entirely. Called on disconnect, after revoking at Google. service_role only.';

do $$
declare f text;
begin
  foreach f in array array[
    'public.vault_upsert_secret(text, text)',
    'public.vault_read_secret(uuid)',
    'public.vault_delete_secret(uuid)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke all on function %s from anon', f);
    execute format('revoke all on function %s from authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- drop function if exists public.vault_delete_secret(uuid);
-- drop function if exists public.vault_read_secret(uuid);
-- drop function if exists public.vault_upsert_secret(text, text);
