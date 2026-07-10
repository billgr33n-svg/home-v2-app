-- 0018_stock_from_purchase.sql
-- Close the buy -> stock loop.
--
-- Until now, marking a shopping item bought taught `item_catalog` (0013) and
-- did nothing else. No `purchased` movement was written, so the fridge only
-- learned it had been restocked if a human re-scanned the item. That is the
-- single largest hole in the food system: the ledger was only ever true by
-- accident.
--
-- This lives in the database, not the client, for the same reason 0013 does:
-- it must fire regardless of which surface marks the item bought (web today,
-- native or an automation later).
--
-- DESIGN NOTES
--
-- 1. Units. `inventory_movements` has a CHECK (delta <> 0), so there is no such
--    thing as a zero-delta audit row. When the shopping unit and the inventory
--    unit disagree (bought 2 lb of an item counted in `each`) we deliberately do
--    NOT touch the balance, because silently adding 2 to a count of packages is
--    worse than not stocking at all. We record WHY on the shopping row instead,
--    via `stocked_at` / `stock_note`, so the app can say "Bought, not stocked".
--
-- 2. Un-buying is a correction, not an erasure. The ledger is append-only
--    (see 0017), so reopening a completed item emits an offsetting `adjusted`
--    movement rather than deleting the `purchased` one.
--
-- 3. Recursion. This is an AFTER UPDATE trigger on shopping_items that then
--    UPDATEs shopping_items. The nested write re-fires the trigger, but both
--    branches are guarded on a state TRANSITION (`old.state is distinct from
--    new.state`), which is false the second time through. Same guard style as
--    `app.learn_item_from_purchase`.
--
-- Rollback at the bottom.

alter table public.shopping_items
  add column if not exists stocked_at timestamptz,
  add column if not exists stock_note text;

comment on column public.shopping_items.stocked_at is
  'When this purchase was posted to the inventory ledger. NULL means it was bought but never stocked; stock_note says why.';
comment on column public.shopping_items.stock_note is
  'Human-readable reason the purchase did not (or did) reach inventory.';

create or replace function app.stock_from_purchase()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item        public.inventory_items%rowtype;
  v_qty         numeric;
  v_units_agree boolean;
  v_stocked     timestamptz := null;
  v_note        text := null;
begin
  ------------------------------------------------------------------
  -- Branch A: item was just marked bought. Stock it.
  ------------------------------------------------------------------
  if new.state = 'completed'
     and old.state is distinct from 'completed'
     and new.deleted_at is null
  then
    -- Resolve the inventory row this purchase belongs to: explicit link first,
    -- then a name match within the household, then create it.
    if new.inventory_item_id is not null then
      select * into v_item
        from public.inventory_items
       where id = new.inventory_item_id and deleted_at is null;
    end if;

    if v_item.id is null then
      select * into v_item
        from public.inventory_items
       where household_id = new.household_id
         and deleted_at is null
         and lower(btrim(name)) = lower(btrim(new.name))
       order by updated_at desc
       limit 1;
    end if;

    if v_item.id is null then
      insert into public.inventory_items
        (household_id, name, category, brand, unit, preferred_store,
         count_mode, quantity, purchased_on, updated_by)
      values
        (new.household_id, btrim(new.name), new.category, new.preferred_brand,
         new.unit, new.store, 'exact', 0, current_date, new.claimed_by)
      returning * into v_item;
    end if;

    v_qty := coalesce(new.quantity, 1);
    v_units_agree :=
      v_item.unit is null
      or new.unit is null
      or lower(btrim(v_item.unit)) = lower(btrim(new.unit));

    if v_qty <= 0 then
      v_note := 'Bought, nothing to stock (quantity ' || v_qty || ').';

    elsif not v_units_agree then
      v_note := 'Bought, not stocked: unit mismatch (bought in ' || new.unit
                || ', counted in ' || v_item.unit || '). Adjust by hand.';

    else
      insert into public.inventory_movements
        (household_id, item_id, delta, reason, note, created_by)
      values
        (new.household_id, v_item.id, v_qty, 'purchased',
         'Bought: ' || btrim(new.name), new.claimed_by);

      -- An item created by a scan may have no unit yet. The purchase teaches it.
      if v_item.unit is null and new.unit is not null then
        update public.inventory_items
           set unit = new.unit
         where id = v_item.id;
      end if;

      v_stocked := now();
      v_note := null;
    end if;

    update public.shopping_items
       set inventory_item_id = v_item.id,
           stocked_at        = v_stocked,
           stock_note        = v_note
     where id = new.id;

    return null;
  end if;

  ------------------------------------------------------------------
  -- Branch B: a bought item was reopened. Offset, do not erase.
  ------------------------------------------------------------------
  if old.state = 'completed'
     and new.state is distinct from 'completed'
     and old.stocked_at is not null
     and old.inventory_item_id is not null
  then
    insert into public.inventory_movements
      (household_id, item_id, delta, reason, note, created_by)
    values
      (old.household_id, old.inventory_item_id, -coalesce(old.quantity, 1),
       'adjusted', 'Reopened: ' || btrim(old.name) || ' was not actually bought',
       new.claimed_by);

    update public.shopping_items
       set stocked_at = null,
           stock_note = null
     where id = new.id;
  end if;

  return null;
end $$;

comment on function app.stock_from_purchase() is
  'Posts a completed shopping item to the inventory ledger as a purchased movement, creating the inventory row if needed. Skips the balance (with a reason) on unit mismatch. Offsets on reopen.';

drop trigger if exists trg_stock_from_purchase on public.shopping_items;
create trigger trg_stock_from_purchase
  after update on public.shopping_items
  for each row
  execute function app.stock_from_purchase();

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- drop trigger if exists trg_stock_from_purchase on public.shopping_items;
-- drop function if exists app.stock_from_purchase();
-- alter table public.shopping_items drop column if exists stocked_at;
-- alter table public.shopping_items drop column if exists stock_note;
