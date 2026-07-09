-- 0017_inventory_movements.sql
-- Every change in how much of something you have is an EVENT, not just a new number.
--
-- Before this, inventory_items.quantity was overwritten in place. That can tell
-- you what's in the fridge, but not:
--   * how much food did we throw away last month, and which items
--   * did we run out of milk because we drank it or because it spoiled
--   * who used the last of the parmesan
--
-- So quantity becomes a running BALANCE maintained by a trigger, and the truth
-- lives in inventory_movements. Nothing writes quantity directly any more.
--
-- reason:
--   purchased -- came into the house
--   counted   -- a physical recount; delta reconciles the books to reality
--   used      -- consumed, as intended
--   spoiled   -- thrown away because it went bad  (waste)
--   scrapped  -- thrown away for any other reason (broken, stale, disliked)
--   adjusted  -- a correction with no physical event behind it
--
-- 'used' and 'spoiled' are deliberately different reasons. Both remove food;
-- only one of them is a failure. Collapsing them would destroy the only signal
-- that tells you you're buying too much arugula.

create type public.inventory_reason as enum
  ('purchased', 'counted', 'used', 'spoiled', 'scrapped', 'adjusted');

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  -- Signed: negative removes from the shelf, positive adds.
  delta numeric not null,
  reason public.inventory_reason not null,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint im_delta_nonzero check (delta <> 0)
);

create index if not exists im_item_idx on public.inventory_movements(item_id, created_at desc);
create index if not exists im_household_idx on public.inventory_movements(household_id, created_at desc);
create index if not exists im_reason_idx on public.inventory_movements(household_id, reason, created_at desc);

grant select, insert on public.inventory_movements to authenticated;
-- Movements are an append-only ledger. Correcting a mistake means adding an
-- offsetting movement, not editing history. So: no update, no delete.

-- The movement's item must live in the movement's household.
create or replace function app.im_guard() returns trigger language plpgsql set search_path = '' as $$
declare ih uuid;
begin
  select household_id into ih from public.inventory_items where id = new.item_id;
  if ih is null or ih <> new.household_id then
    raise exception 'movement item must belong to the movement household';
  end if;
  return new;
end $$;

create trigger trg_im_guard before insert on public.inventory_movements
  for each row execute function app.im_guard();

-- Apply the movement to the running balance.
create or replace function app.apply_movement() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  update public.inventory_items
  set quantity = greatest(coalesce(quantity, 0) + new.delta, 0),
      count_mode = 'exact',
      -- Only a physical recount updates "when did we last look at this".
      last_counted_at = case when new.reason = 'counted' then now() else last_counted_at end,
      updated_by = coalesce(new.created_by, updated_by),
      updated_at = now()
  where id = new.item_id;
  return new;
end $$;

create trigger trg_apply_movement after insert on public.inventory_movements
  for each row execute function app.apply_movement();

alter table public.inventory_movements enable row level security;

create policy im_select on public.inventory_movements for select to authenticated
  using (app.is_active_household_member(household_id));
create policy im_insert on public.inventory_movements for insert to authenticated
  with check (app.is_active_household_member(household_id));

-- ROLLBACK --------------------------------------------------------------------
-- drop trigger if exists trg_apply_movement on public.inventory_movements;
-- drop trigger if exists trg_im_guard on public.inventory_movements;
-- drop function if exists app.apply_movement();
-- drop function if exists app.im_guard();
-- drop table if exists public.inventory_movements;
-- drop type if exists public.inventory_reason;
