import { supabase } from '../lib/supabase';
import { sortInventory, type InventoryLevel, type InventoryView, type RawInventoryItem } from '../domain/inventory';

export async function fetchInventory(householdId: string): Promise<InventoryView[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(
      'id,name,category,brand,count_mode,quantity,unit,approximate_level,min_quantity,par_quantity,' +
        'preferred_store,location_id,purchased_on,last_counted_at,locations(name)',
    )
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (error) throw error;
  const raw: RawInventoryItem[] = (data ?? []).map((r) => {
    const loc = r.locations as unknown as { name: string } | null;
    return {
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
      locationName: loc?.name ?? null,
      purchasedOn: r.purchased_on,
      lastCountedAt: r.last_counted_at,
    };
  });
  return sortInventory(raw);
}

export interface InventoryPatch {
  name?: string;
  brand?: string | null;
  unit?: string | null;
  quantity?: number | null;
  category?: string | null;
  locationId?: string | null;
  store?: string | null;
  purchasedOn?: string | null;
  minQuantity?: number | null;
  parQuantity?: number | null;
}

/**
 * Edit an item. Editing details (renaming, re-filing) is NOT a count, so it
 * deliberately does not touch last_counted_at -- only changing the quantity does.
 */
export async function updateInventoryItem(itemId: string, patch: InventoryPatch): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const row: Record<string, unknown> = { updated_by: uid };
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.brand !== undefined) row.brand = patch.brand;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.locationId !== undefined) row.location_id = patch.locationId;
  if (patch.store !== undefined) row.preferred_store = patch.store;
  if (patch.purchasedOn !== undefined) row.purchased_on = patch.purchasedOn;
  if (patch.minQuantity !== undefined) row.min_quantity = patch.minQuantity;
  if (patch.parQuantity !== undefined) row.par_quantity = patch.parQuantity;
  if (patch.quantity !== undefined) {
    row.quantity = patch.quantity;
    row.last_counted_at = new Date().toISOString();
  }

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
  const patch: Record<string, number | null> = {};
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
