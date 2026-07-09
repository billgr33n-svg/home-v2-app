import { supabase } from '../lib/supabase';

export interface EventView {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
}

function startOfTodayISO(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Today's and upcoming timed events, RLS-scoped to the household.
// (All-day events carry all_day_start instead of starts_at; not surfaced yet.)
export async function fetchUpcomingEvents(householdId: string): Promise<EventView[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,starts_at,ends_at')
    .eq('household_id', householdId)
    .gte('starts_at', startOfTodayISO())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: String(e.starts_at),
    endsAt: e.ends_at ?? null,
  }));
}

// Create a timed event. The schema requires exactly one of starts_at (timed) or
// all_day_start (all-day); we always write the timed form.
export async function createEvent(
  householdId: string,
  title: string,
  startsAt: string,
  endsAt: string,
): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase.from('events').insert({
    household_id: householdId,
    creator_id: uid,
    title,
    starts_at: startsAt,
    ends_at: endsAt,
  });
  if (error) throw error;
}
