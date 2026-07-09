import { supabase } from '../lib/supabase';
import { buildShoppingList, type RawShoppingItem, type ShoppingList } from '../domain/shopping';

export interface ItemSuggestion {
  name: string;
  brand: string | null;
  unit: string | null;
  store: string | null;
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

// Autocomplete source, in priority order:
//   1. item_catalog  -- store-specific brand/size vocabulary (e.g. seeded from Instacart)
//   2. inventory_items -- what the household actually keeps
//   3. shopping_items  -- what they've asked for before
//
// Brand and size are store-specific, so the dedupe key is (name, store), not
// name alone. Typing "milk" can therefore surface a Costco row, a Kroger row and
// a Publix row side by side. Catalog rows win ties because they carry the store.
export async function fetchItemSuggestions(householdId: string): Promise<ItemSuggestion[]> {
  const [catRes, invRes, shopRes] = await Promise.all([
    supabase
      .from('item_catalog')
      .select('name,brand,unit,store')
      .eq('household_id', householdId)
      .is('deleted_at', null),
    supabase
      .from('inventory_items')
      .select('name,brand,unit')
      .eq('household_id', householdId)
      .is('deleted_at', null),
    supabase
      .from('shopping_items')
      .select('name,preferred_brand,unit,store')
      .eq('household_id', householdId)
      .is('deleted_at', null),
  ]);
  if (catRes.error) throw catRes.error;
  if (invRes.error) throw invRes.error;
  if (shopRes.error) throw shopRes.error;

  const key = (name: string, store: string | null) => `${name.toLowerCase()}|${store ?? ''}`;
  const byKey = new Map<string, ItemSuggestion>();

  const put = (s: ItemSuggestion) => {
    const k = key(s.name, s.store);
    if (!byKey.has(k)) byKey.set(k, s);
  };

  for (const r of catRes.data ?? []) {
    put({ name: r.name, brand: r.brand ?? null, unit: r.unit ?? null, store: r.store ?? null });
  }
  for (const r of invRes.data ?? []) {
    put({ name: r.name, brand: r.brand ?? null, unit: r.unit ?? null, store: null });
  }
  for (const r of shopRes.data ?? []) {
    put({ name: r.name, brand: r.preferred_brand ?? null, unit: r.unit ?? null, store: r.store ?? null });
  }

  // A storeless row is redundant once the same item has store-specific rows.
  const storedNames = new Set(
    [...byKey.values()].filter((s) => s.store).map((s) => s.name.toLowerCase()),
  );
  return [...byKey.values()]
    .filter((s) => s.store || !storedNames.has(s.name.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name) || (a.store ?? '').localeCompare(b.store ?? ''));
}

export async function addShoppingItem(
  householdId: string,
  name: string,
  opts?: { brand?: string | null; quantity?: number | null; unit?: string | null; store?: string | null },
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
    store: opts?.store ?? null,
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
