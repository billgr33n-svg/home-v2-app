import { supabase } from '../lib/supabase';

/**
 * Every change to how much of something you have is an event, not a new number.
 *
 * 'used' and 'spoiled' both remove food. Only one of them is a failure. Keeping
 * them apart is the whole point: it's the only signal that tells you you're
 * buying more arugula than you eat.
 */
export type MovementReason = 'purchased' | 'counted' | 'used' | 'spoiled' | 'scrapped' | 'adjusted';

export const REASON_LABEL: Record<MovementReason, string> = {
  purchased: 'Bought',
  counted: 'Counted',
  used: 'Used',
  spoiled: 'Went bad',
  scrapped: 'Thrown out',
  adjusted: 'Adjusted',
};

export interface Movement {
  id: string;
  delta: number;
  reason: MovementReason;
  note: string | null;
  createdAt: string;
}

/** delta is signed: negative removes from the shelf. Zero is rejected by the DB. */
export async function recordMovement(
  householdId: string,
  itemId: string,
  delta: number,
  reason: MovementReason,
  note?: string,
): Promise<void> {
  if (delta === 0) return; // nothing happened; don't write a meaningless row
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const { error } = await supabase.from('inventory_movements').insert({
    household_id: householdId,
    item_id: itemId,
    delta,
    reason,
    note: note ?? null,
    created_by: uid,
  });
  if (error) throw error;
}

/**
 * Consume some of an item. Amount is positive; we negate it.
 * NOT named `useAmount`: a `use` prefix marks a React hook, and this is a
 * network call — the lint rule that caught this was right.
 */
export function consumeAmount(householdId: string, itemId: string, amount: number, note?: string) {
  return recordMovement(householdId, itemId, -Math.abs(amount), 'used', note);
}

/** Threw it away because it went bad. Recorded as waste, not consumption. */
export function markSpoiled(householdId: string, itemId: string, amount: number, note?: string) {
  return recordMovement(householdId, itemId, -Math.abs(amount), 'spoiled', note);
}

/** Threw it away for some other reason (stale, broken, nobody liked it). */
export function markScrapped(householdId: string, itemId: string, amount: number, note?: string) {
  return recordMovement(householdId, itemId, -Math.abs(amount), 'scrapped', note);
}

/**
 * A physical recount. We store the delta needed to reconcile the books to what
 * you actually see on the shelf, so the ledger still adds up to the balance.
 */
export function recordCount(householdId: string, itemId: string, from: number, to: number) {
  const delta = to - from;
  if (delta === 0) return Promise.resolve();
  return recordMovement(householdId, itemId, delta, 'counted');
}

export interface BulkMovement {
  itemId: string;
  delta: number;
  reason: MovementReason;
  note?: string;
}

/**
 * Many movements, one round trip. The DB trigger applies each to its item's
 * balance, so bulk edits stay events rather than becoming overwrites.
 * Zero-delta rows are dropped: the DB rejects them, and "nothing changed" isn't
 * an error worth failing the whole batch over.
 */
export async function recordMovements(householdId: string, rows: readonly BulkMovement[]): Promise<number> {
  const real = rows.filter((r) => r.delta !== 0);
  if (real.length === 0) return 0;

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const { error } = await supabase.from('inventory_movements').insert(
    real.map((r) => ({
      household_id: householdId,
      item_id: r.itemId,
      delta: r.delta,
      reason: r.reason,
      note: r.note ?? null,
      created_by: uid,
    })),
  );
  if (error) throw error;
  return real.length;
}

export interface Countable {
  id: string;
  quantity: number | null;
}

/** Recount many items to the same absolute amount. Delta differs per item. */
export function bulkSetAmount(householdId: string, items: readonly Countable[], to: number) {
  return recordMovements(
    householdId,
    items.map((i) => ({ itemId: i.id, delta: to - (i.quantity ?? 0), reason: 'counted' as const })),
  );
}

/** Consume the same amount from each item, never taking more than it has. */
export function bulkConsume(householdId: string, items: readonly Countable[], amountEach: number) {
  return recordMovements(
    householdId,
    items.map((i) => {
      const have = i.quantity ?? 0;
      const take = Math.min(Math.abs(amountEach), have);
      return { itemId: i.id, delta: -take, reason: 'used' as const };
    }),
  );
}

/** Throw away everything on hand for each item, as waste or as scrap. */
export function bulkDiscardAll(
  householdId: string,
  items: readonly Countable[],
  reason: 'spoiled' | 'scrapped',
  note?: string,
) {
  return recordMovements(
    householdId,
    items.map((i) => ({ itemId: i.id, delta: -(i.quantity ?? 0), reason, note })),
  );
}

export async function fetchMovements(itemId: string, limit = 8): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id,delta,reason,note,created_at')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    delta: Number(r.delta),
    reason: r.reason as MovementReason,
    note: r.note,
    createdAt: r.created_at,
  }));
}

export interface WasteSummary {
  spoiledEvents: number;
  spoiledUnits: number;
  usedUnits: number;
}

/** "How much did we throw away this month?" — the question the ledger exists to answer. */
export async function fetchWasteSince(householdId: string, since: Date): Promise<WasteSummary> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('delta,reason')
    .eq('household_id', householdId)
    .gte('created_at', since.toISOString())
    .in('reason', ['used', 'spoiled', 'scrapped']);
  if (error) throw error;

  let spoiledEvents = 0;
  let spoiledUnits = 0;
  let usedUnits = 0;
  for (const r of data ?? []) {
    const units = Math.abs(Number(r.delta));
    if (r.reason === 'used') usedUnits += units;
    else {
      spoiledEvents += 1;
      spoiledUnits += units;
    }
  }
  return { spoiledEvents, spoiledUnits, usedUnits };
}
