-- 0019_inventory_lots.sql
-- Expiry, modelled honestly.
--
-- `inventory_items.expires_on` has existed since 0001 and was never read by a
-- single line of app code. That is fortunate, because one date per item is the
-- wrong model: two half-gallons of milk bought a week apart have two dates, and
-- a single column can only ever record one of them (or lie).
--
-- A LOT is a batch of one item that shares a date. Milk can have two lots.
--
-- THE IMPORTANT DESIGN DECISION (read this before you file a bug):
--
--   Lots are an ADVISORY FRESHNESS OVERLAY. They are NOT the balance authority.
--   `inventory_items.quantity` remains the running balance maintained by the
--   append-only movement ledger (0017). sum(lots.quantity) may legitimately be
--   LESS than inventory_items.quantity, because nobody is ever going to lot-track
--   salt, paper towels, or a bag of rice.
--
--   The alternative -- making lots authoritative -- would force lot-tracking on
--   every item in the house to keep the balance correct. That system decays to
--   garbage in three weeks. This one degrades gracefully: track dates on the
--   things that rot, ignore the rest.
--
--   Consequence: `consume_lot()` writes BOTH sides (decrements the lot AND posts
--   a movement) so the two never drift when the app is the one moving stock.
--   A bare movement (a scan, a bulk count) moves the balance and leaves lots
--   alone. That is intended.
--
-- `inventory_items.expires_on` is left in place, deprecated, rather than dropped:
-- it is nullable, unread, and dropping a column from a live table for tidiness
-- is not worth the migration risk. Marked with a comment so nobody wires it up.
--
-- Rollback at the bottom.

create table if not exists public.inventory_lots (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete restrict,
  item_id       uuid not null references public.inventory_items(id) on delete cascade,
  quantity      numeric not null default 0 check (quantity >= 0),
  unit          text,
  expires_on    date,
  opened_on     date,
  purchased_on  date,
  note          text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table public.inventory_lots is
  'A batch of one inventory item sharing an expiry date. Advisory freshness overlay; inventory_items.quantity remains the balance authority (see 0019 header).';

comment on column public.inventory_items.expires_on is
  'DEPRECATED as of 0019. One date cannot describe two batches. Use inventory_lots. Do not wire this up.';

-- Household of the lot must be the household of the item. Same shape as app.mir_guard.
create or replace function app.lot_guard()
returns trigger language plpgsql set search_path = '' as $$
declare ih uuid;
begin
  select household_id into ih from public.inventory_items where id = new.item_id;
  if ih is null or ih <> new.household_id then
    raise exception 'inventory lot household must match the item household';
  end if;
  return new;
end $$;

drop trigger if exists trg_lot_guard on public.inventory_lots;
create trigger trg_lot_guard
  before insert or update on public.inventory_lots
  for each row execute function app.lot_guard();

drop trigger if exists trg_lots_touch on public.inventory_lots;
create trigger trg_lots_touch
  before update on public.inventory_lots
  for each row execute function app.touch_updated_at();

-- Supabase grants ALL on new public tables to anon + authenticated by default.
-- RLS already denies anon (is_active_household_member is false for it), but say it out loud.
revoke all on public.inventory_lots from anon;
grant select, insert, update on public.inventory_lots to authenticated;

alter table public.inventory_lots enable row level security;

drop policy if exists lots_select on public.inventory_lots;
create policy lots_select on public.inventory_lots
  for select to authenticated
  using (app.is_active_household_member(household_id));

drop policy if exists lots_insert on public.inventory_lots;
create policy lots_insert on public.inventory_lots
  for insert to authenticated
  with check (app.is_active_household_member(household_id));

drop policy if exists lots_update on public.inventory_lots;
create policy lots_update on public.inventory_lots
  for update to authenticated
  using (app.is_active_household_member(household_id))
  with check (app.is_active_household_member(household_id));

-- "What dies this week" is the only query that matters here, so index for it.
create index if not exists inventory_lots_expiring_idx
  on public.inventory_lots (household_id, expires_on)
  where deleted_at is null and quantity > 0;

create index if not exists inventory_lots_item_idx
  on public.inventory_lots (item_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- consume_lot: the one path that moves a lot and the ledger together.
--
-- SECURITY INVOKER on purpose: RLS on inventory_lots and inventory_movements
-- does the isolation, exactly as it does for every other write. A stranger
-- passing someone else's lot id sees zero rows and gets 'lot not found'.
-- ---------------------------------------------------------------------------
create or replace function public.consume_lot(
  p_lot    uuid,
  p_amount numeric,
  p_reason public.inventory_reason default 'used',
  p_note   text default null
) returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lot    public.inventory_lots%rowtype;
  v_take   numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_reason not in ('used','spoiled','scrapped') then
    raise exception 'consume_lot handles used/spoiled/scrapped, not %', p_reason;
  end if;

  select * into v_lot from public.inventory_lots
   where id = p_lot and deleted_at is null
   for update;

  if v_lot.id is null then
    raise exception 'lot not found';
  end if;

  -- Never consume more than the lot holds; the caller's arithmetic is not trusted.
  v_take := least(p_amount, v_lot.quantity);
  if v_take <= 0 then
    return 0;
  end if;

  insert into public.inventory_movements (household_id, item_id, delta, reason, note, created_by)
  values (v_lot.household_id, v_lot.item_id, -v_take, p_reason,
          coalesce(p_note, case when v_lot.expires_on is null then null
                                else 'Lot dated ' || v_lot.expires_on end),
          auth.uid());

  update public.inventory_lots
     set quantity   = quantity - v_take,
         deleted_at = case when quantity - v_take <= 0 then now() else deleted_at end
   where id = v_lot.id;

  return v_take;
end $$;

comment on function public.consume_lot(uuid, numeric, public.inventory_reason, text) is
  'Consume from a lot and post the matching movement in one transaction. Reason must be used/spoiled/scrapped -- the used/spoiled split is what preserves the waste signal.';

revoke all on function public.consume_lot(uuid, numeric, public.inventory_reason, text) from public, anon;
grant execute on function public.consume_lot(uuid, numeric, public.inventory_reason, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- drop function if exists public.consume_lot(uuid, numeric, public.inventory_reason, text);
-- drop table if exists public.inventory_lots;
-- drop function if exists app.lot_guard();
