import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import { sortInventory, type InventoryLevel, type InventoryView, type RawInventoryItem } from '../domain/inventory';

export async function fetchInventory(householdId: string): Promise<InventoryView[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    // Must be a single string literal: supabase-js infers the row shape from it,
    // and a concatenated string degrades to `GenericStringError`.
    .select(
      'id,name,category,brand,count_mode,quantity,unit,approximate_level,min_quantity,par_quantity,preferred_store,location_id,purchased_on,last_counted_at',
    )
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (error) throw error;

  // Resolve location names with a second query rather than a PostgREST embed.
  // The embed works at runtime but its generated types are fragile, and a
  // household has a dozen locations -- this is a map lookup, not a join cost.
  const { data: locs, error: locErr } = await supabase
    .from('locations')
    .select('id,name')
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (locErr) throw locErr;
  const locName = new Map((locs ?? []).map((l) => [l.id, l.name]));

  const raw: RawInventoryItem[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    countMode: r.count_mode,
    quantity: r.quantity,
    unit: r.unit,
    approximateLevel: r.approximate_level,
    minQuantity: r.min_quantity,
    parQuantity: r.par_quantity,
    brand: r.brand,
    store: r.preferred_store,
    locationId: r.location_id,
    locationName: r.location_id ? locName.get(r.location_id) ?? null : null,
    purchasedOn: r.purchased_on,
    lastCountedAt: r.last_counted_at,
  }));
  return sortInventory(raw);
}

export interface InventoryPatch {
  name?: string;
  brand?: string | null;
  unit?: string | null;
  category?: string | null;
  locationId?: string | null;
  store?: string | null;
  purchasedOn?: string | null;
  minQuantity?: number | null;
  parQuantity?: number | null;
}

/**
 * Edit an item's DETAILS. Quantity is deliberately not settable here: since the
 * movements ledger (migration 0017) the balance is derived from events, so
 * changing it means recording a count, not overwriting a number. Use
 * `recordCount` from api/movements.
 */
export async function updateInventoryItem(itemId: string, patch: InventoryPatch): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  type Patch = Database['public']['Tables']['inventory_items']['Update'];
  const row: Patch = { updated_by: uid };
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.brand !== undefined) row.brand = patch.brand;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.locationId !== undefined) row.location_id = patch.locationId;
  if (patch.store !== undefined) row.preferred_store = patch.store;
  if (patch.purchasedOn !== undefined) row.purchased_on = patch.purchasedOn;
  if (patch.minQuantity !== undefined) row.min_quantity = patch.minQuantity;
  if (patch.parQuantity !== undefined) row.par_quantity = patch.parQuantity;

  const { error } = await supabase.from('inventory_items').update(row).eq('id', itemId);
  if (error) throw error;
}

/** Soft delete: the item leaves the shelf, the history stays. */
export async function removeInventoryItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw error;
}

// Reorder point (min) and ideal level (par). Set either independently.
export async function setStockTargets(
  itemId: string,
  targets: { minQuantity?: number | null; parQuantity?: number | null },
): Promise<void> {
  type Targets = Database['public']['Tables']['inventory_items']['Update'];
  const patch: Targets = {};
  if ('minQuantity' in targets) patch.min_quantity = targets.minQuantity ?? null;
  if ('parQuantity' in targets) patch.par_quantity = targets.parQuantity ?? null;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('inventory_items').update(patch).eq('id', itemId);
  if (error) throw error;
}

// Approximate is the preferred posture (PRODUCT_RULES 9): setting a level marks
// the item approximate.
export async function setInventoryLevel(itemId: string, level: InventoryLevel): Promise<void> {
  const { error } = await supabase
    .from('inventory_items')
    .update({ approximate_level: level, count_mode: 'approximate' })
    .eq('id', itemId);
  if (error) throw error;
}
