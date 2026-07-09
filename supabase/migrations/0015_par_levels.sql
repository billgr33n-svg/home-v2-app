-- 0015_par_levels.sql
-- Reorder points and ideal ("par") levels on inventory.
--
-- inventory_items already had min_quantity -- the reorder point, the level at
-- which the item should land on the shopping list. It was never surfaced.
--
-- par_quantity is the level we want to return TO. The two are different numbers
-- and both are needed: min answers "should I buy?", par answers "how much?".
-- Order quantity = par_quantity - quantity.
--
-- Restaurants and hospitals have called this a par level for a century. A pantry
-- is the same problem at a smaller scale.

alter table public.inventory_items add column if not exists par_quantity numeric;

alter table public.inventory_items drop constraint if exists inv_par_nonneg;
alter table public.inventory_items add constraint inv_par_nonneg
  check (par_quantity is null or par_quantity >= 0);

alter table public.inventory_items drop constraint if exists inv_par_ge_min;
alter table public.inventory_items add constraint inv_par_ge_min
  check (par_quantity is null or min_quantity is null or par_quantity >= min_quantity);

-- ROLLBACK --------------------------------------------------------------------
-- alter table public.inventory_items drop constraint if exists inv_par_ge_min;
-- alter table public.inventory_items drop constraint if exists inv_par_nonneg;
-- alter table public.inventory_items drop column if exists par_quantity;
