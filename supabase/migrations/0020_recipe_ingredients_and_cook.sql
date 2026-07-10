-- 0020_recipe_ingredients_and_cook.sql
-- Cook -> consume, and the recipe model that makes "what can we make tonight?"
-- answerable.
--
-- TWO PROBLEMS THIS SOLVES
--
-- 1. `recipes.ingredients` is a jsonb blob (0001). Fine for reading a recipe,
--    useless for matching one against a pantry. Ingredients become rows.
--
-- 2. `meal_ingredient_reservations` and the `reserved_quantity` sync trigger
--    have existed since M4 (0009) and are referenced by ZERO lines of app code.
--    Nothing reserves, nothing releases, `reserved_quantity` is permanently 0.
--    Cooking a meal never removed anything from the fridge. `cook_meal()` closes
--    that edge.
--
-- SCOPE DECISIONS -- read before "improving" this
--
-- * MATCH ON PRESENCE, NOT QUANTITY. "You have all 7 ingredients" is ~90% of the
--   value of a pantry matcher and ~10% of the work. "You have exactly 2 tbsp of
--   butter" requires a general unit converter (a recipe wants 2 tbsp; the fridge
--   holds 2/3 of a package) and that swamp is where this feature would die.
--
-- * MATCHING IS EXACT-NAME OR EXPLICITLY LINKED. Fuzzy substring matching is a
--   trap: inventory "peanut butter" matches ingredient "butter" under every
--   naive contains/word-boundary rule anyone reaches for. So an ingredient
--   matches an inventory item when (a) it carries an explicit inventory_item_id,
--   or (b) the normalized names are equal. The household teaches the link once
--   and it compounds -- the same principle as `item_catalog` learning from
--   purchases in 0013.
--
-- * QUANTITIES STAY HUMAN. The recipe suggests; a person sets the amount on the
--   reservation. cook_meal() then consumes exactly what was reserved. No guessing.
--
-- There are zero rows in `recipes` today, so there is no jsonb backfill here.
-- If recipes ever get written the old way, backfill separately and deliberately.
--
-- Rollback at the bottom.

-- ---------------------------------------------------------------------------
-- recipe_ingredients
-- ---------------------------------------------------------------------------
create table if not exists public.recipe_ingredients (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households(id) on delete restrict,
  recipe_id         uuid not null references public.recipes(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  name              text not null,
  match_name        text generated always as (lower(btrim(name))) stored,
  quantity          numeric check (quantity is null or quantity >= 0),
  unit              text,
  optional          boolean not null default false,
  sort_order        int not null default 0,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.recipe_ingredients is
  'One ingredient of a recipe, as a row. Matching against the pantry is by explicit inventory_item_id or exact normalized name -- never by substring (see 0020 header).';
comment on column public.recipe_ingredients.inventory_item_id is
  'Taught link: "this recipe''s unsalted butter is my Butter item". Set once, reused forever.';
comment on column public.recipe_ingredients.quantity is
  'Advisory. The matcher ignores it. Only a reservation''s quantity is ever consumed.';

create or replace function app.ri_guard()
returns trigger language plpgsql set search_path = '' as $$
declare rh uuid; ih uuid;
begin
  select household_id into rh from public.recipes where id = new.recipe_id;
  if rh is null or rh <> new.household_id then
    raise exception 'recipe ingredient household must match the recipe household';
  end if;
  if new.inventory_item_id is not null then
    select household_id into ih from public.inventory_items where id = new.inventory_item_id;
    if ih is null or ih <> new.household_id then
      raise exception 'linked inventory item must belong to the recipe household';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_ri_guard on public.recipe_ingredients;
create trigger trg_ri_guard
  before insert or update on public.recipe_ingredients
  for each row execute function app.ri_guard();

drop trigger if exists trg_ri_touch on public.recipe_ingredients;
create trigger trg_ri_touch
  before update on public.recipe_ingredients
  for each row execute function app.touch_updated_at();

revoke all on public.recipe_ingredients from anon;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;

alter table public.recipe_ingredients enable row level security;

drop policy if exists ri_select on public.recipe_ingredients;
create policy ri_select on public.recipe_ingredients
  for select to authenticated using (app.is_active_household_member(household_id));

drop policy if exists ri_insert on public.recipe_ingredients;
create policy ri_insert on public.recipe_ingredients
  for insert to authenticated with check (app.is_active_household_member(household_id));

drop policy if exists ri_update on public.recipe_ingredients;
create policy ri_update on public.recipe_ingredients
  for update to authenticated
  using (app.is_active_household_member(household_id))
  with check (app.is_active_household_member(household_id));

drop policy if exists ri_delete on public.recipe_ingredients;
create policy ri_delete on public.recipe_ingredients
  for delete to authenticated using (app.is_active_household_member(household_id));

create index if not exists recipe_ingredients_recipe_idx
  on public.recipe_ingredients (recipe_id) where deleted_at is null;
create index if not exists recipe_ingredients_match_idx
  on public.recipe_ingredients (household_id, match_name) where deleted_at is null;

-- meal_ingredient_reservations was created before the "revoke anon" habit.
revoke all on public.meal_ingredient_reservations from anon;

-- ---------------------------------------------------------------------------
-- What can we make tonight?
--
-- Presence only. An item counts as on-hand when the exact balance is positive,
-- or (for approximately-counted things) the level is anything but 'out'.
-- SECURITY INVOKER: RLS on inventory_items and recipe_ingredients does the
-- isolation, so a stranger's household id simply returns nothing.
-- ---------------------------------------------------------------------------
create or replace function public.recipe_pantry_match(p_household uuid)
returns table (
  recipe_id      uuid,
  recipe_name    text,
  required_count int,
  have_count     int,
  missing        text[]
)
language sql
security invoker
stable
set search_path = ''
as $$
  with on_hand as (
    select i.id, lower(btrim(i.name)) as match_name
      from public.inventory_items i
     where i.household_id = p_household
       and i.deleted_at is null
       and (
         (i.count_mode = 'exact' and coalesce(i.quantity, 0) > 0)
         or (i.count_mode = 'approximate'
             and coalesce(i.approximate_level, 'unknown') not in ('out', 'unknown'))
       )
  ),
  scored as (
    select r.id, r.name, ri.name as ingredient, ri.optional,
           exists (
             select 1 from on_hand o
              where (ri.inventory_item_id is not null and o.id = ri.inventory_item_id)
                 or (ri.inventory_item_id is null and o.match_name = ri.match_name)
           ) as have
      from public.recipes r
      join public.recipe_ingredients ri
        on ri.recipe_id = r.id and ri.deleted_at is null
     where r.household_id = p_household
       and r.deleted_at is null
  )
  select id,
         name,
         count(*) filter (where not optional)::int,
         count(*) filter (where have and not optional)::int,
         coalesce(array_agg(ingredient order by ingredient)
                    filter (where not have and not optional), '{}')
    from scored
   group by id, name;
$$;

comment on function public.recipe_pantry_match(uuid) is
  'Per recipe: how many required ingredients the household has on hand, and which are missing. Presence only -- quantities are deliberately ignored.';

revoke all on function public.recipe_pantry_match(uuid) from public, anon;
grant execute on function public.recipe_pantry_match(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cook_meal: the edge that was severed.
--
-- Consumes every reservation attached to the meal as a `used` movement, releases
-- the reservation (the 0009 sync trigger zeroes reserved_quantity), and marks the
-- meal cooked. Idempotent by refusing to re-cook.
--
-- SECURITY INVOKER: RLS decides whether the caller can see the meal at all.
-- ---------------------------------------------------------------------------
create or replace function public.cook_meal(p_meal uuid)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_meal     public.meals%rowtype;
  v_consumed int := 0;
  r          record;
begin
  select * into v_meal from public.meals
   where id = p_meal and deleted_at is null
   for update;

  if v_meal.id is null then
    raise exception 'meal not found';
  end if;
  if v_meal.status = 'cooked' then
    raise exception 'meal already cooked';
  end if;
  if v_meal.status not in ('planned', 'requested') then
    raise exception 'cannot cook a meal in state %', v_meal.status;
  end if;

  for r in
    select id, inventory_item_id, quantity
      from public.meal_ingredient_reservations
     where meal_id = p_meal and deleted_at is null and quantity > 0
  loop
    insert into public.inventory_movements
      (household_id, item_id, delta, reason, note, created_by)
    values
      (v_meal.household_id, r.inventory_item_id, -r.quantity, 'used',
       'Cooked: ' || v_meal.title, auth.uid());

    -- Soft-delete releases the reservation; app.sync_reserved_quantity() then
    -- recomputes inventory_items.reserved_quantity from what remains.
    update public.meal_ingredient_reservations
       set deleted_at = now()
     where id = r.id;

    v_consumed := v_consumed + 1;
  end loop;

  update public.meals set status = 'cooked' where id = p_meal;

  return v_consumed;
end $$;

comment on function public.cook_meal(uuid) is
  'Marks a meal cooked and consumes its ingredient reservations as `used` movements. The used/spoiled split is preserved: cooking is not waste.';

revoke all on function public.cook_meal(uuid) from public, anon;
grant execute on function public.cook_meal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- drop function if exists public.cook_meal(uuid);
-- drop function if exists public.recipe_pantry_match(uuid);
-- drop table if exists public.recipe_ingredients;
-- drop function if exists app.ri_guard();
