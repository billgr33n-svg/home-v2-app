import { supabase } from '../lib/supabase';
import { summarizeDinner, type DinnerSummary, type MealResponse } from '../domain/meals';

export interface MealView {
  id: string;
  title: string;
  plannedAt: string;
  summary: DinnerSummary;
  myResponse: MealResponse | null;
  outstandingNames: string[];
}

function startOfTodayISO(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Today's and upcoming dinners, reduced to a per-meal response summary.
// All reads are RLS-scoped to the household; meal_responses is filtered by RLS,
// not by an explicit household clause (mirrors polls).
export async function fetchMeals(householdId: string): Promise<MealView[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const [mealsRes, membersRes, respRes, profilesRes] = await Promise.all([
    supabase
      .from('meals')
      .select('id,title,planned_at')
      .eq('household_id', householdId)
      .gte('planned_at', startOfTodayISO())
      .is('deleted_at', null)
      .order('planned_at', { ascending: true }),
    supabase
      .from('household_memberships')
      .select('user_id')
      .eq('household_id', householdId)
      .eq('state', 'active'),
    supabase.from('meal_responses').select('meal_id,user_id,response,guest_count'),
    supabase.from('profiles').select('id,display_name'),
  ]);
  if (mealsRes.error) throw mealsRes.error;
  if (membersRes.error) throw membersRes.error;
  if (respRes.error) throw respRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const memberIds = (membersRes.data ?? [])
    .map((m) => m.user_id)
    .filter((x): x is string => Boolean(x));
  const nameById: Record<string, string> = {};
  for (const p of profilesRes.data ?? []) nameById[p.id] = p.display_name;

  const byMeal: Record<string, { userId: string; response: MealResponse; guestCount: number }[]> = {};
  for (const r of respRes.data ?? []) {
    (byMeal[r.meal_id] ??= []).push({
      userId: r.user_id,
      response: r.response as MealResponse,
      guestCount: r.guest_count ?? 0,
    });
  }

  return (mealsRes.data ?? []).map((m) => {
    const resps = byMeal[m.id] ?? [];
    const summary = summarizeDinner(
      memberIds,
      resps.map((r) => ({ userId: r.userId, response: r.response, guestCount: r.guestCount })),
    );
    return {
      id: m.id,
      title: m.title,
      plannedAt: m.planned_at,
      summary,
      myResponse: resps.find((r) => r.userId === uid)?.response ?? null,
      outstandingNames: summary.outstandingIds.map((id) => nameById[id] ?? 'Someone'),
    };
  });
}

// Self-only by RLS (migration 0009): a member can write only their own row.
export async function respondToDinner(mealId: string, response: MealResponse): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase
    .from('meal_responses')
    .upsert({ meal_id: mealId, user_id: uid, response }, { onConflict: 'meal_id,user_id' });
  if (error) throw error;
}
