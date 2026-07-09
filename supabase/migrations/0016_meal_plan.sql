-- 0016_meal_plan.sql
-- A weekly meal plan: breakfast, lunch, dinner for each day.
--
-- KEY MODELLING DECISION: "OYO" (on your own) is the ABSENCE of a meal, not a
-- special kind of meal. Every slot in every week is OYO until somebody plans
-- something. This means:
--   * no backfilling 21 rows a week for a household that plans two dinners
--   * "make this OYO again" is a delete, not a state transition
--   * the plan is correct for any date, past or future, with zero rows
--
-- meal_type already existed (default 'dinner') and now carries the slot.
-- Constraints are added NOT VALID first so legacy rows can't block the
-- migration, then validated -- if validation fails we learn about the bad rows
-- rather than silently accepting them.

alter table public.meals drop constraint if exists meals_slot_known;
alter table public.meals add constraint meals_slot_known
  check (meal_type in ('breakfast', 'lunch', 'dinner')) not valid;

alter table public.meals drop constraint if exists meals_status_known;
alter table public.meals add constraint meals_status_known
  check (status in ('planned', 'requested', 'cooked', 'skipped')) not valid;

alter table public.meals validate constraint meals_slot_known;
alter table public.meals validate constraint meals_status_known;

-- One meal per slot per day. Soft-deleted rows don't hold the slot hostage.
create unique index if not exists meals_one_per_slot
  on public.meals (household_id, ((planned_at at time zone 'UTC')::date), meal_type)
  where deleted_at is null;

create index if not exists meals_planned_at_idx on public.meals(household_id, planned_at);

-- ROLLBACK --------------------------------------------------------------------
-- drop index if exists meals_one_per_slot;
-- drop index if exists meals_planned_at_idx;
-- alter table public.meals drop constraint if exists meals_status_known;
-- alter table public.meals drop constraint if exists meals_slot_known;
