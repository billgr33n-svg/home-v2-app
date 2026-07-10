import { supabase } from '../lib/supabase';

export interface EventView {
  id: string;
  title: string;
  /** Timed events: ISO timestamp. All-day events: 'YYYY-MM-DD'. */
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  description: string | null;
  /** All-day events carry a date, not a time; render them without a clock. */
  allDay: boolean;
}

const EVENT_COLUMNS = 'id,title,starts_at,ends_at,all_day_start,all_day_end,location_text,description';

interface EventRow {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day_start: string | null;
  all_day_end: string | null;
  location_text: string | null;
  description: string | null;
}

function toView(e: EventRow): EventView {
  const allDay = e.starts_at == null;
  return {
    id: e.id,
    title: e.title,
    startsAt: allDay ? String(e.all_day_start) : String(e.starts_at),
    endsAt: allDay ? (e.all_day_end ?? null) : (e.ends_at ?? null),
    location: e.location_text ?? null,
    description: e.description ?? null,
    allDay,
  };
}

function startOfTodayISO(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Today's and upcoming timed events, RLS-scoped to the household.
export async function fetchUpcomingEvents(householdId: string): Promise<EventView[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('household_id', householdId)
    .gte('starts_at', startOfTodayISO())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toView);
}

/**
 * Every event whose start falls inside [fromISO, toISO) — timed AND all-day.
 *
 * Two queries rather than one `.or()`: supabase-js infers the row type from a
 * string LITERAL only, and a hand-built or() filter string degrades the whole
 * result to GenericStringError (this exact class of bug bit fetchInventory).
 * fromDate/toDate are LOCAL 'YYYY-MM-DD' strings because all_day_start is a
 * date column: comparing it against a UTC instant shifts events across
 * midnight for anyone west of Greenwich, which is everyone in Milton, GA.
 */
export async function fetchEventsInRange(
  householdId: string,
  fromISO: string,
  toISO: string,
  fromDate: string,
  toDate: string,
): Promise<EventView[]> {
  const timed = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('household_id', householdId)
    .gte('starts_at', fromISO)
    .lt('starts_at', toISO)
    .order('starts_at', { ascending: true });
  if (timed.error) throw timed.error;

  const allDay = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('household_id', householdId)
    .gte('all_day_start', fromDate)
    .lt('all_day_start', toDate)
    .order('all_day_start', { ascending: true });
  if (allDay.error) throw allDay.error;

  return [...(allDay.data ?? []), ...(timed.data ?? [])].map(toView);
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
