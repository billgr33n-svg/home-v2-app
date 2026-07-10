// Calendar date math. LOCAL-date based throughout: a 6pm dinner on Sunday must
// not render on Monday because the ISO string crossed midnight UTC (same rule
// the meal-plan week math follows). All arithmetic goes through the Date
// constructor's part form, which is DST-safe — adding 24h of milliseconds is
// not, twice a year.

import type { EventView } from '../api/events';

export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Local 'YYYY-MM-DD' for a Date. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Midnight local time, n days after d. */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** The Sunday that starts d's week, at local midnight. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}

/** The first of d's month, at local midnight. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * The 42 days (6 rows x 7) that a month grid shows: leading days from the
 * previous month back to Sunday, the month itself, trailing days to fill.
 * Always 42 so the grid never changes height as you page between months.
 */
export function monthGridDays(monthStart: Date): Date[] {
  const first = startOfWeek(startOfMonth(monthStart));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** The local day an event belongs to. All-day events already carry the key. */
export function eventDayKey(e: EventView): string {
  return e.allDay ? e.startsAt : dateKey(new Date(e.startsAt));
}

/** Events bucketed by local day, all-day first, then by start time. */
export function groupByDay(events: EventView[]): Map<string, EventView[]> {
  const by = new Map<string, EventView[]>();
  for (const e of events) {
    const k = eventDayKey(e);
    const list = by.get(k) ?? [];
    list.push(e);
    by.set(k, list);
  }
  for (const list of by.values()) {
    list.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startsAt < b.startsAt ? -1 : 1;
    });
  }
  return by;
}

export function timeLabel(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = pad2(d.getMinutes());
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/** "6:00 – 7:30 PM", or "All day", for a detail view. */
export function timeRangeLabel(e: EventView): string {
  if (e.allDay) return 'All day';
  const start = timeLabel(e.startsAt);
  return e.endsAt ? `${start} – ${timeLabel(e.endsAt)}` : start;
}
