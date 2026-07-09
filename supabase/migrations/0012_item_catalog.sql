-- 0012_item_catalog.sql
-- Store-aware autocomplete catalog for the shopping list.
--
-- Why a separate table: brand and package size are store-specific ("Milk" is a
-- 1 gal Kirkland jug at Costco and a 64 oz Publix carton at Publix). Seeding
-- these into inventory_items would claim the household owns them; seeding into
-- shopping_items would put them on the list to buy. Neither is true. This table
-- is vocabulary only -- it never implies possession or intent to purchase.
--
-- RLS is the standard household-isolation posture (M1 gate, deny by default).
-- Rollback at the bottom.

create table if not exists public.item_catalog (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null,
  brand text,
  unit text,
  store text,
  source text not null default 'manual',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ic_name_nonempty check (length(btrim(name)) > 0),
  constraint ic_source_known check (source in ('manual', 'instacart'))
);

create index if not exists ic_household_idx on public.item_catalog(household_id);
create index if not exists ic_name_idx on public.item_catalog(household_id, lower(name));

-- One row per (household, item, store). Partial so soft-deleted rows don't block reuse.
create unique index if not exists ic_unique_per_store
  on public.item_catalog(household_id, lower(name), coalesce(store, ''))
  where deleted_at is null;

grant select, insert, update, delete on public.item_catalog to authenticated;

create trigger trg_touch_updated_at before update on public.item_catalog
  for each row execute function app.touch_updated_at();

alter table public.item_catalog enable row level security;

create policy ic_select on public.item_catalog for select to authenticated
  using (app.is_active_household_member(household_id));
create policy ic_insert on public.item_catalog for insert to authenticated
  with check (app.is_active_household_member(household_id));
create policy ic_update on public.item_catalog for update to authenticated
  using (app.is_active_household_member(household_id))
  with check (app.is_active_household_member(household_id));
create policy ic_delete on public.item_catalog for delete to authenticated
  using (app.is_active_household_member(household_id));

-- ROLLBACK --------------------------------------------------------------------
-- drop trigger if exists trg_touch_updated_at on public.item_catalog;
-- drop table if exists public.item_catalog;
