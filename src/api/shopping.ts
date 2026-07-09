import { supabase } from '../lib/supabase';
import { buildShoppingList, type RawShoppingItem, type ShoppingList } from '../domain/shopping';

export interface ItemSuggestion {
  name: string;
  brand: string | null;
  unit: string | null;
}

export async function fetchShoppingList(householdId: string): Promise<ShoppingList> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('id,name,preferred_brand,quantity,unit,store,state')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const raw: RawShoppingItem[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.preferred_brand,
    quantity: r.quantity,
    unit: r.unit,
    store: r.store,
    state: r.state,
  }));
  return buildShoppingList(raw);
}

// Autocomplete source: the household's own pantry + past shopping items, so
// brand and size get reused rather than retyped. No external product database.
export async function fetchItemSuggestions(householdId: string): Promise<ItemSuggestion[]> {
  const [invRes, shopRes] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('name,brand,unit')
      .eq('household_id', householdId)
      .is('deleted_at', null),
    supabase
      .from('shopping_items')
      .select('name,preferred_brand,unit')
      .eq('household_id', householdId)
      .is('deleted_at', null),
  ]);
  if (invRes.error) throw invRes.error;
  if (shopRes.error) throw shopRes.error;

  const byName = new Map<string, ItemSuggestion>();
  for (const r of invRes.data ?? []) {
    const key = r.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, { name: r.name, brand: r.brand ?? null, unit: r.unit ?? null });
  }
  for (const r of shopRes.data ?? []) {
    const key = r.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, { name: r.name, brand: r.preferred_brand ?? null, unit: r.unit ?? null });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function addShoppingItem(
  householdId: string,
  name: string,
  opts?: { brand?: string | null; quantity?: number | null; unit?: string | null },
): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase.from('shopping_items').insert({
    household_id: householdId,
    requester_id: uid,
    name,
    preferred_brand: opts?.brand ?? null,
    quantity: opts?.quantity ?? null,
    unit: opts?.unit ?? null,
  });
  if (error) throw error;
}

// Mark bought (or reopen). Completing records who bought it and when.
export async function setShoppingItemDone(itemId: string, done: boolean): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id ?? null;
  const patch = done
    ? { state: 'completed' as const, completed_at: new Date().toISOString(), claimed_by: uid }
    : { state: 'new' as const, completed_at: null, claimed_by: null };
  const { error } = await supabase.from('shopping_items').update(patch).eq('id', itemId);
  if (error) throw error;
}
