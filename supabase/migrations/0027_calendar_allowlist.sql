-- 0027_calendar_allowlist
--
-- Pin a calendar connection to specific calendars.
--
-- google-calendar-sync used to import every calendar the person keeps *selected*
-- in Google. That floods a household calendar with US holidays, sports-team
-- subscriptions, and work calendars the owner happens to have checked. When
-- `calendar_allowlist` is non-null and non-empty, sync imports ONLY those
-- provider calendar ids. Null/empty preserves the legacy "all selected" behaviour.
--
-- The Green household is pinned to just the shared Family calendar.

alter table public.calendar_connections
  add column if not exists calendar_allowlist text[];

comment on column public.calendar_connections.calendar_allowlist is
  'When non-null and non-empty, google-calendar-sync imports ONLY these provider calendar ids. Null/empty = every calendar the user keeps selected in Google (legacy behaviour). Set to pin a household to one shared calendar and keep holidays/sports/work calendars out.';
