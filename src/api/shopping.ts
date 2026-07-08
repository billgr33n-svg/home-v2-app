import { supabase } from '../lib/supabase';
import { buildShoppingList, type RawShoppingItem, type ShoppingList } from '../domain/shopping';

export async function fetchShoppingList(householdId: string): Promise<ShoppingList> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('id,name,quantity,unit,store,state')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const raw: RawShoppingItem[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    quantity: r.quantity,
    unit: r.unit,
    store: r.store,
    state: r.state,
  }));
  return buildShoppingList(raw);
}

export async function addShoppingItem(householdId: string, name: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase
    .from('shopping_items')
    .insert({ household_id: householdId, requester_id: uid, name });
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
