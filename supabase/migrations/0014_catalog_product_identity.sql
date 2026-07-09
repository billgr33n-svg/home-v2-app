-- 0014_catalog_product_identity.sql
-- Two additions to item_catalog:
--
--   category  -- grouping for the inventory/shop UI (Produce, Dairy, Meat, ...)
--   full_name -- the retailer's authoritative product title, verbatim
--
-- Why keep full_name: `name` is a normalized, human-typed label ("Ground beef").
-- full_name is what the store actually calls it ("Kirkland Signature Ground Beef
-- 88% Lean / 12% Fat"). The normalized name drives autocomplete; the full name is
-- what we'd hand to Instacart's shopping-list API, and what disambiguates two
-- similar rows a year from now. Losing it means re-deriving it by hand.
--
-- Deliberately NOT storing product image URLs: Instacart serves them as
-- JWT-signed, expiring links, so a stored URL rots. Images should come from a
-- stable source (barcode lookup) or be self-hosted.

alter table public.item_catalog add column if not exists category text;
alter table public.item_catalog add column if not exists full_name text;

create index if not exists ic_category_idx on public.item_catalog(household_id, category);

-- ROLLBACK --------------------------------------------------------------------
-- drop index if exists ic_category_idx;
-- alter table public.item_catalog drop column if exists full_name;
-- alter table public.item_catalog drop column if exists category;
