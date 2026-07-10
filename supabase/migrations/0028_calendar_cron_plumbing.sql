-- 0028_calendar_cron_plumbing
--
-- Daily calendar sync plumbing.
--
-- pg_cron fires a daily job that POSTs to the google-calendar-sync-cron Edge
-- Function. That function runs as service_role and syncs EVERY active Google
-- connection (the user-facing google-calendar-sync only does the caller's own).
--
-- AUTH without handling a key: a 64-char random secret lives only in Vault. The
-- cron SQL reads it from vault.decrypted_secrets and sends it as an x-cron-secret
-- header; the Edge Function reads the same value via read_cron_secret() and
-- compares. Nobody ever sees the value.
--
-- The cron.schedule() call itself lives outside this migration (run once via SQL)
-- so re-running migrations never duplicates the job.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_sync_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'cron_sync_secret',
      'Shared secret: pg_cron -> google-calendar-sync-cron authentication'
    );
  end if;
end $$;

create or replace function public.read_cron_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_secret' limit 1;
$$;

revoke all on function public.read_cron_secret() from public;
grant execute on function public.read_cron_secret() to service_role;
