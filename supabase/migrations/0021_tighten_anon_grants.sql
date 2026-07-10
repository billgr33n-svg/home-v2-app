-- 0021_tighten_anon_grants.sql
-- Housekeeping the security advisor has been asking for.
--
-- 1. `accept_invite` is SECURITY DEFINER and was callable by `anon`. It is
--    reachable from the M2 join flow, which always runs signed in. Nothing
--    anonymous should be able to burn an invite token.
--
-- 2. Supabase grants ALL on new public tables to anon + authenticated by default.
--    RLS denies anon on every one of these (app.is_active_household_member is
--    false without a JWT), so this changes no behaviour. It removes the layer of
--    "the only thing standing between anon and this table is one policy".
--    Defence in depth costs nothing here.
--
-- Rollback at the bottom.

revoke execute on function public.accept_invite(text) from anon;

do $$
declare t text;
begin
  foreach t in array array[
    'announcement_recipients','announcements','attachments','comments',
    'event_participants','events','home_assets','household_invites',
    'household_memberships','households','inventory_items','inventory_movements',
    'item_catalog','locations','maintenance_issues','maintenance_schedules',
    'meal_ingredient_reservations','meal_responses','meals','notifications',
    'poll_responses','polls','profiles','properties','recipes','ride_passengers',
    'ride_updates','rides','service_records','shopping_items','tasks'
  ]
  loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- `audit_events` and `calendar_connections` are server-only and already locked.

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- grant execute on function public.accept_invite(text) to anon;
-- (Table grants: re-grant per table only if a genuinely anonymous surface appears.)
