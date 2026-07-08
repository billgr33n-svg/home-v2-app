-- 0009_m4_meals.sql
-- M4: dinner responses + meal-ingredient reservations modeled.
--
-- Two parts:
--   1. Tighten meal_responses writes to the acting user (user_id = auth.uid()).
--      This closes the response-table follow-up noted after M3 (a member could
--      previously write another member's row within the household). SELECT stays
--      household-scoped so the family can see who is in or out (PRODUCT_RULES).
--   2. meal_ingredient_reservations: models the link between a planned meal and
--      pantry stock. Household-isolated (same helper as every tenant table),
--      household-match guarded, non-negative, and kept in sync with
--      inventory_items.reserved_quantity by trigger.
--
-- Depends on: 0003 (app.is_active_household_member), 0004 (app.touch_updated_at,
-- deleted_at/soft-delete posture, inventory_items.reserved_quantity).
-- Rollback block at the bottom.

-- 1. Self-only dinner-response writes ------------------------------------------

drop policy if exists meal_responses_insert on public.meal_responses;
drop policy if exists meal_responses_update on public.meal_responses;
drop policy if exists meal_responses_delete on public.meal_responses;

create policy meal_responses_insert on public.meal_responses for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meals m
      where m.id = meal_id and app.is_active_household_member(m.household_id)
    )
  );

create policy meal_responses_update on public.meal_responses for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meals m
      where m.id = meal_id and app.is_active_household_member(m.household_id)
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meals m
      where m.id = meal_id and app.is_active_household_member(m.household_id)
    )
  );

create policy meal_responses_delete on public.meal_responses for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meals m
      where m.id = meal_id and app.is_active_household_member(m.household_id)
    )
  );

-- 2. Meal-ingredient reservations ---------------------------------------------

create table if not exists public.meal_ingredient_reservations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  meal_id uuid not null references public.meals(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric not null default 0,
  unit text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint mir_qty_nonneg check (quantity >= 0),
  unique (meal_id, inventory_item_id)
);

create index if not exists mir_household_idx on public.meal_ingredient_reservations(household_id);
create index if not exists mir_meal_idx on public.meal_ingredient_reservations(meal_id);
create index if not exists mir_item_idx on public.meal_ingredient_reservations(inventory_item_id);

grant select, insert, update, delete on public.meal_ingredient_reservations to authenticated;

-- Defense in depth: a CHECK cannot subquery, so a trigger enforces that a
-- reservation's household matches both the meal and the inventory item.
create or replace function app.mir_guard() returns trigger language plpgsql set search_path = '' as $$
declare mh uuid; ih uuid;
begin
  select household_id into mh from public.meals where id = new.meal_id;
  select household_id into ih from public.inventory_items where id = new.inventory_item_id;
  if mh is null or new.household_id <> mh then
    raise exception 'reservation household must match the meal household';
  end if;
  if ih is null or ih <> mh then
    raise exception 'inventory item must belong to the meal household';
  end if;
  return new;
end $$;

create trigger trg_mir_guard before insert or update on public.meal_ingredient_reservations
  for each row execute function app.mir_guard();

-- Keep inventory_items.reserved_quantity equal to the sum of live reservations.
create or replace function app.sync_reserved_quantity() returns trigger language plpgsql set search_path = '' as $$
declare ids uuid[] := array[]::uuid[]; t uuid;
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.inventory_item_id is not null then
    ids := ids || new.inventory_item_id;
  end if;
  if (tg_op = 'DELETE' or tg_op = 'UPDATE') and old.inventory_item_id is not null then
    ids := ids || old.inventory_item_id;
  end if;
  foreach t in array ids loop
    update public.inventory_items i
      set reserved_quantity = coalesce((
        select sum(r.quantity) from public.meal_ingredient_reservations r
        where r.inventory_item_id = t and r.deleted_at is null
      ), 0)
      where i.id = t;
  end loop;
  return null;
end $$;

create trigger trg_sync_reserved after insert or update or delete on public.meal_ingredient_reservations
  for each row execute function app.sync_reserved_quantity();

-- updated_at maintenance (reuses the 0004 helper).
create trigger trg_touch_updated_at before update on public.meal_ingredient_reservations
  for each row execute function app.touch_updated_at();

-- RLS: identical household-isolation posture as every other tenant table.
alter table public.meal_ingredient_reservations enable row level security;

create policy mir_select on public.meal_ingredient_reservations for select to authenticated
  using (app.is_active_household_member(household_id));
create policy mir_insert on public.meal_ingredient_reservations for insert to authenticated
  with check (app.is_active_household_member(household_id));
create policy mir_update on public.meal_ingredient_reservations for update to authenticated
  using (app.is_active_household_member(household_id))
  with check (app.is_active_household_member(household_id));
create policy mir_delete on public.meal_ingredient_reservations for delete to authenticated
  using (app.is_active_household_member(household_id));

-- ROLLBACK --------------------------------------------------------------------
-- Run this block to reverse 0009. It drops the reservation model and restores
-- the original household-scoped (not self-scoped) meal_responses write policies
-- from 0003.
--
-- drop trigger if exists trg_touch_updated_at on public.meal_ingredient_reservations;
-- drop trigger if exists trg_sync_reserved on public.meal_ingredient_reservations;
-- drop trigger if exists trg_mir_guard on public.meal_ingredient_reservations;
-- drop table if exists public.meal_ingredient_reservations;
-- drop function if exists app.sync_reserved_quantity();
-- drop function if exists app.mir_guard();
--
-- drop policy if exists meal_responses_insert on public.meal_responses;
-- drop policy if exists meal_responses_update on public.meal_responses;
-- drop policy if exists meal_responses_delete on public.meal_responses;
-- create policy meal_responses_insert on public.meal_responses for insert to authenticated
--   with check (exists (select 1 from public.meals p where p.id = meal_id and app.is_active_household_member(p.household_id)));
-- create policy meal_responses_update on public.meal_responses for update to authenticated
--   using (exists (select 1 from public.meals p where p.id = meal_responses.meal_id and app.is_active_household_member(p.household_id)))
--   with check (exists (select 1 from public.meals p where p.id = meal_responses.meal_id and app.is_active_household_member(p.household_id)));
-- create policy meal_responses_delete on public.meal_responses for delete to authenticated
--   using (exists (select 1 from public.meals p where p.id = meal_responses.meal_id and app.is_active_household_member(p.household_id)));
