-- 0013_catalog_learns.sql
-- The shopping catalog learns from real purchases.
--
-- When a shopping item is marked bought and it carries a brand or a store, we
-- upsert that (name, store) -> (brand, unit) into item_catalog. Next time anyone
-- types that item, the suggestion reflects what the household actually buys.
--
-- This lives in the database, not the client, so it fires regardless of which
-- surface marks the item bought (web today, native or an automation later).
--
-- Guard: rows with neither brand nor store teach us nothing, and would just
-- duplicate the inventory-derived suggestion. Those are skipped.
--
-- adds 'learned' to the allowed sources. Rollback at the bottom.

alter table public.item_catalog drop constraint if exists ic_source_known;
alter table public.item_catalog add constraint ic_source_known
  check (source in ('manual', 'instacart', 'learned'));

create or replace function app.learn_item_from_purchase()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Only on the transition into 'completed', and only if there's something to learn.
  if new.state = 'completed'
     and old.state is distinct from 'completed'
     and (new.preferred_brand is not null or new.store is not null)
     and new.deleted_at is null
  then
    insert into public.item_catalog (household_id, name, brand, unit, store, source, created_by)
    values (
      new.household_id,
      btrim(new.name),
      new.preferred_brand,
      new.unit,
      new.store,
      'learned',
      new.claimed_by
    )
    on conflict (household_id, lower(name), coalesce(store, '')) where deleted_at is null
    do update set
      -- Last purchase wins, but never overwrite a known value with null.
      brand = coalesce(excluded.brand, public.item_catalog.brand),
      unit  = coalesce(excluded.unit,  public.item_catalog.unit),
      updated_at = now();
  end if;
  return new;
end $$;

create trigger trg_learn_item_from_purchase
  after update on public.shopping_items
  for each row execute function app.learn_item_from_purchase();

-- ROLLBACK --------------------------------------------------------------------
-- drop trigger if exists trg_learn_item_from_purchase on public.shopping_items;
-- drop function if exists app.learn_item_from_purchase();
-- alter table public.item_catalog drop constraint if exists ic_source_known;
-- alter table public.item_catalog add constraint ic_source_known
--   check (source in ('manual', 'instacart'));
