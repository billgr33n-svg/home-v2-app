import { supabase } from '../lib/supabase';

/**
 * The reservation layer that has existed in the schema since M4 (0009) and was
 * called by nothing until now.
 *
 * A reservation says "this meal will use this much of this inventory item". The
 * DB trigger keeps `inventory_items.reserved_quantity` in sync, so the Shop
 * screen can stop suggesting you buy something that is already spoken for.
 *
 * Quantities are set by a person, not derived from a recipe. See the header of
 * migration 0020: matching a recipe to a pantry is a presence problem, and
 * converting "2 tbsp" into "a fraction of the butter package in the door" is a
 * unit-conversion swamp we are deliberately not entering.
 */

// String literal, not concatenation. See api/lots.ts.
const RESERVATION_SELECT = 'id, inventory_item_id, quantity, unit, inventory_items(name, unit, quantity)';

export interface Reservation {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string | null;
  /** What the fridge currently holds, so the UI can warn before over-reserving. */
  onHand: number | null;
}

export async function fetchReservations(mealId: string): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('meal_ingredient_reservations')
    .select(RESERVATION_SELECT)
    .eq('meal_id', mealId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    itemId: r.inventory_item_id,
    itemName: r.inventory_items?.name ?? 'Unknown item',
    quantity: Number(r.quantity),
    unit: r.unit ?? r.inventory_items?.unit ?? null,
    onHand: r.inventory_items?.quantity == null ? null : Number(r.inventory_items.quantity),
  }));
}

export async function reserveIngredient(
  householdId: string,
  mealId: string,
  itemId: string,
  quantity: number,
  unit: string | null,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('meal_ingredient_reservations').insert({
    household_id: householdId,
    meal_id: mealId,
    inventory_item_id: itemId,
    quantity,
    unit,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

/** Soft-delete: the sync trigger recomputes reserved_quantity from what remains. */
export async function releaseIngredient(reservationId: string): Promise<void> {
  const { error } = await supabase
    .from('meal_ingredient_reservations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', reservationId);
  if (error) throw error;
}

/**
 * Mark the meal cooked and consume its reservations as `used` movements.
 *
 * All of it happens inside `cook_meal()` because a client cannot make N ledger
 * writes and a status change atomic. Returns how many ingredients were consumed.
 */
export async function cookMeal(mealId: string): Promise<number> {
  const { data, error } = await supabase.rpc('cook_meal', { p_meal: mealId });
  if (error) throw error;
  return Number(data ?? 0);
}
