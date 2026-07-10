import { supabase } from '../lib/supabase';
import { buildTodayFeed, type TodayInput, type TodayItem } from '../domain/today';

function dayBoundsISO(now = new Date()): { start: string; end: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Fetches the household's Today-relevant rows and reduces them to an ordered
// feed of exceptions and decisions. All reads are RLS-scoped to the household.
// Versions come along so Today can complete a task race-safely (ADR-0008).
export async function fetchTodayFeed(householdId: string): Promise<TodayItem[]> {
  const { start, end } = dayBoundsISO();

  const [membersRes, ridesRes, mealsRes, pollsRes, annRes, tasksRes, maintRes, profilesRes] = await Promise.all([
    supabase
      .from('household_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('state', 'active'),
    supabase
      .from('rides')
      .select('id,driver_id,destination_text,pickup_text,state,version')
      .eq('household_id', householdId)
      .in('state', ['needed', 'offered', 'assigned', 'confirmed'])
      .is('deleted_at', null),
    supabase
      .from('meals')
      .select('id,title,planned_at')
      .eq('household_id', householdId)
      .gte('planned_at', start)
      .lte('planned_at', end)
      .is('deleted_at', null),
    supabase
      .from('polls')
      .select('id,question,options')
      .eq('household_id', householdId)
      .is('closed_at', null)
      .is('deleted_at', null),
    supabase
      .from('announcements')
      .select('id,title,state')
      .eq('household_id', householdId)
      .eq('state', 'active')
      .is('deleted_at', null),
    supabase
      .from('tasks')
      .select('id,title,owner_id,state,due_at,version')
      .eq('household_id', householdId)
      .not('state', 'in', '(completed,verified,canceled,skipped)')
      .is('deleted_at', null),
    supabase
      .from('maintenance_issues')
      .select('id,title,state')
      .eq('household_id', householdId)
      .not('state', 'in', '(resolved,closed)')
      .is('deleted_at', null),
    supabase.from('profiles').select('id,display_name'),
  ]);

  for (const res of [membersRes, ridesRes, mealsRes, pollsRes, annRes, tasksRes, maintRes, profilesRes]) {
    if (res.error) throw res.error;
  }

  const activeMemberCount = membersRes.count ?? 0;

  const mealRows = mealsRes.data ?? [];
  const respByMeal: Record<string, number> = {};
  if (mealRows.length > 0) {
    const { data: resp, error } = await supabase
      .from('meal_responses')
      .select('meal_id')
      .in('meal_id', mealRows.map((m) => m.id));
    if (error) throw error;
    for (const row of resp ?? []) respByMeal[row.meal_id] = (respByMeal[row.meal_id] ?? 0) + 1;
  }

  // Distinct responders per open poll: outstanding is members minus who has voted.
  const pollRows = pollsRes.data ?? [];
  const respByPoll: Record<string, Set<string>> = {};
  if (pollRows.length > 0) {
    const { data: presp, error } = await supabase
      .from('poll_responses')
      .select('poll_id,user_id')
      .in('poll_id', pollRows.map((p) => p.id));
    if (error) throw error;
    for (const row of presp ?? []) (respByPoll[row.poll_id] ??= new Set<string>()).add(row.user_id);
  }

  // Today shows exceptions, not the whole backlog: keep a task only if it is
  // unassigned (it needs an owner) or due today / overdue. An assigned task with
  // a future or absent due date lives in the Tasks tab, not here.
  const taskRows = (tasksRes.data ?? []).filter(
    (t) => t.owner_id == null || (t.due_at != null && t.due_at <= end),
  );

  const nameById: Record<string, string> = {};
  for (const p of profilesRes.data ?? []) nameById[p.id] = p.display_name;

  const input: TodayInput = {
    activeMemberCount,
    rides: (ridesRes.data ?? []).map((r) => ({
      id: r.id,
      driverId: r.driver_id,
      destination: r.destination_text,
      pickup: r.pickup_text,
      version: r.version,
    })),
    meals: mealRows.map((m) => ({ id: m.id, title: m.title, respondedCount: respByMeal[m.id] ?? 0 })),
    polls: pollRows.map((p) => {
      const options = Array.isArray(p.options) ? (p.options as unknown[]).map(String) : [];
      const responded = respByPoll[p.id]?.size ?? 0;
      return {
        id: p.id,
        question: p.question,
        outstandingCount: Math.max(0, activeMemberCount - responded),
        options,
      };
    }),
    announcements: (annRes.data ?? []).map((a) => ({ id: a.id, title: a.title })),
    tasks: taskRows.map((t) => ({
      id: t.id,
      title: t.title,
      ownerId: t.owner_id,
      ownerName: t.owner_id ? nameById[t.owner_id] ?? null : null,
      version: t.version,
    })),
    maintenance: (maintRes.data ?? []).map((m) => ({ id: m.id, title: m.title })),
  };

  return buildTodayFeed(input);
}
