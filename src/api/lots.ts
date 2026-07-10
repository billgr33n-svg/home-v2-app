import { supabase } from '../lib/supabase';
import { toLotView, type LotView } from '../domain/lots';
import type { MovementReason } from './movements';

/**
 * `select()` is a string LITERAL on purpose.
 *
 * supabase-js infers the row type from the literal. Build the same string by
 * concatenation and the inferred type degrades to `GenericStringError`, which
 * silently poisons everything downstream. That happened once in fetchInventory.
 * Do not "tidy" this into a template.
 */
const LOT_SELECT = 'id, item_id, quantity, unit, expires_on, purchased_on, opened_on, note, inventory_items(name)';

export async function fetchLots(householdId: string, now: Date = new Date()): Promise<LotView[]> {
  const { data, error } = await supabase
    .from('inventory_lots')
    .select(LOT_SELECT)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .gt('quantity', 0)
    .order('expires_on', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []).map((row) => toLotView(row, now));
}

export interface NewLot {
  itemId: string;
  quantity: number;
  unit?: string | null;
  expiresOn?: string | null;
  purchasedOn?: string | null;
  note?: string | null;
}

export async function addLot(householdId: string, lot: NewLot): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('inventory_lots').insert({
    household_id: householdId,
    item_id: lot.itemId,
    quantity: lot.quantity,
    unit: lot.unit ?? null,
    expires_on: lot.expiresOn ?? null,
    purchased_on: lot.purchasedOn ?? null,
    note: lot.note ?? null,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

/**
 * Consume from a lot. Always through the RPC, never as two writes.
 *
 * The lot and the movement ledger must move together or they drift, and there
 * is no client-side transaction to make two round-trips atomic.
 */
export async function consumeLot(
  lotId: string,
  amount: number,
  reason: Extract<MovementReason, 'used' | 'spoiled' | 'scrapped'>,
  note?: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('consume_lot', {
    p_lot: lotId,
    p_amount: amount,
    p_reason: reason,
    p_note: note ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function updateLotExpiry(lotId: string, expiresOn: string | null): Promise<void> {
  const { error } = await supabase.from('inventory_lots').update({ expires_on: expiresOn }).eq('id', lotId);
  if (error) throw error;
}
