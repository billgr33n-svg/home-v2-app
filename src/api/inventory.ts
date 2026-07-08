import { supabase } from '../lib/supabase';
import { sortInventory, type InventoryLevel, type InventoryView, type RawInventoryItem } from '../domain/inventory';

export async function fetchInventory(householdId: string): Promise<InventoryView[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id,name,category,count_mode,quantity,unit,approximate_level,min_quantity')
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (error) throw error;
  const raw: RawInventoryItem[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    countMode: r.count_mode,
    quantity: r.quantity,
    unit: r.unit,
    approximateLevel: r.approximate_level,
    minQuantity: r.min_quantity,
  }));
  return sortInventory(raw);
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
