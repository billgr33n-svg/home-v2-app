import { supabase } from '../lib/supabase';
import { plannedAtFor, type RawPlannedMeal, type Slot } from '../domain/mealplan';

interface ProfileRow {
  id: string;
  display_name: string | null;
}

export async function fetchWeekMeals(householdId: string, from: Date, to: Date): Promise<RawPlannedMeal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('id,title,meal_type,planned_at,status,prep_owner_id')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .gte('planned_at', from.toISOString())
    .lt('planned_at', to.toISOString());
  if (error) throw error;

  const rows = data ?? [];
  const cookIds = [...new Set(rows.map((r) => r.prep_owner_id).filter(Boolean))] as string[];

  let names = new Map<string, string>();
  if (cookIds.length > 0) {
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id,display_name')
      .in('id', cookIds);
    if (pErr) throw pErr;
    names = new Map((profs ?? []).map((p: ProfileRow) => [p.id, p.display_name ?? 'Someone']));
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slot: r.meal_type as Slot,
    plannedAt: r.planned_at,
    status: r.status,
    cookId: r.prep_owner_id,
    cookName: r.prep_owner_id ? names.get(r.prep_owner_id) ?? 'Someone' : null,
  }));
}

/** Plan a meal into a slot. One meal per slot per day is enforced by the DB. */
export async function planMeal(
  householdId: string,
  date: string,
  slot: Slot,
  title: string,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('not signed in');

  const { error } = await supabase.from('meals').insert({
    household_id: householdId,
    title: title.trim(),
    meal_type: slot,
    planned_at: plannedAtFor(date, slot),
    status: 'planned',
    created_by: uid,
  });
  if (error) {
    // The one-per-slot unique index. Say something a person can act on.
    if (error.code === '23505') throw new Error('That slot already has a meal. Edit or clear it first.');
    throw error;
  }
}

export async function renameMeal(mealId: string, title: string): Promise<void> {
  const { error } = await supabase.from('meals').update({ title: title.trim() }).eq('id', mealId);
  if (error) throw error;
}

export async function setMealCook(mealId: string, userId: string | null): Promise<void> {
  const { error } = await supabase.from('meals').update({ prep_owner_id: userId }).eq('id', mealId);
  if (error) throw error;
}

/**
 * Clearing a meal returns the slot to OYO. Soft delete, so the unique index
 * releases the slot but the history survives.
 */
export async function clearMeal(mealId: string): Promise<void> {
  const { error } = await supabase
    .from('meals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', mealId);
  if (error) throw error;
}
