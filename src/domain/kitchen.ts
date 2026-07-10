/**
 * The weekly kitchen signup. Pure domain logic: no I/O, no RN, no Supabase.
 *
 * Slots start empty and people claim them. The board is 7 days x 4 daily roles,
 * plus three fridge clean-outs (Kitchen Wed, Garage Fri, Basement Sat).
 *
 * The week begins on a LOCAL Monday. All date arithmetic here walks calendar
 * days, never elapsed milliseconds: a Sunday-evening board must not jump to
 * Monday because the user is west of UTC, and a spring-forward week is still
 * seven days long even though it is 167 hours.
 */

export type KitchenRole = 'am_unload' | 'pm_lead' | 'pm_helper' | 'pm_wipe' | 'fridge';

/** Daily roles, in the order the day actually runs. */
export const DAILY_ROLES: KitchenRole[] = ['am_unload', 'pm_lead', 'pm_helper', 'pm_wipe'];

export const ROLE_LABEL: Record<KitchenRole, string> = {
  am_unload: 'AM Unload',
  pm_lead: 'PM Cleanup — Lead',
  pm_helper: 'PM Cleanup — Helper',
  pm_wipe: 'PM Wipe-down',
  fridge: 'Fridge',
};

/** Short form for a cramped row. */
export const ROLE_SHORT: Record<KitchenRole, string> = {
  am_unload: 'Unload',
  pm_lead: 'Lead',
  pm_helper: 'Helper',
  pm_wipe: 'Wipe-down',
  fridge: 'Fridge',
};

export type ShiftStatus = 'open' | 'claimed' | 'done' | 'skipped';

export interface RawShift {
  id: string;
  shiftDate: string; // YYYY-MM-DD
  role: KitchenRole;
  detail: string | null;
  claimedById: string | null;
  claimedByName: string | null;
  originalClaimedById: string | null;
  originalClaimedByName: string | null;
  completedAt: string | null;
  skippedAt: string | null;
  version: number;
}

export interface ShiftView extends RawShift {
  label: string;
  status: ShiftStatus;
  /** Someone other than the original claimant is holding this slot. */
  covered: boolean;
  /** "Sandy (covering for Bill)" or "Open". */
  whoLabel: string;
  mine: boolean;
}

export interface DayView {
  date: string; // YYYY-MM-DD
  weekdayShort: string;
  dayOfMonth: number;
  isToday: boolean;
  isPast: boolean;
  shifts: ShiftView[];
  openCount: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * The local Monday on or before `now`.
 *
 * getDay() is 0=Sunday. Sunday must map back six days to the PREVIOUS Monday,
 * not forward one. Getting this wrong shifts the whole board by a week for
 * exactly one seventh of the population, every week.
 */
export function weekStart(now: Date): Date {
  const day = now.getDay();
  const backToMonday = day === 0 ? 6 : day - 1;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - backToMonday);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

export function shiftStatus(s: RawShift): ShiftStatus {
  if (s.completedAt) return 'done';
  if (s.skippedAt) return 'skipped';
  return s.claimedById ? 'claimed' : 'open';
}

export function isCovered(s: RawShift): boolean {
  return (
    s.claimedById != null &&
    s.originalClaimedById != null &&
    s.claimedById !== s.originalClaimedById
  );
}

export function whoLabel(s: RawShift): string {
  if (!s.claimedById) return 'Open';
  const holder = s.claimedByName ?? 'Someone';
  if (!isCovered(s)) return holder;
  return `${holder} (covering for ${s.originalClaimedByName ?? 'someone'})`;
}

export function toShiftView(s: RawShift, myUserId: string | null): ShiftView {
  return {
    ...s,
    label: s.role === 'fridge' && s.detail ? `${s.detail} fridge` : ROLE_LABEL[s.role],
    status: shiftStatus(s),
    covered: isCovered(s),
    whoLabel: whoLabel(s),
    mine: s.claimedById != null && s.claimedById === myUserId,
  };
}

/** Roles in board order: the four daily ones, then any fridge duty. */
function roleOrder(role: KitchenRole): number {
  const i = DAILY_ROLES.indexOf(role);
  return i === -1 ? DAILY_ROLES.length : i;
}

export function buildWeek(
  shifts: readonly RawShift[],
  start: Date,
  now: Date,
  myUserId: string | null,
): DayView[] {
  const todayIso = toIsoDate(now);

  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const iso = toIsoDate(d);
    const rows = shifts
      .filter((s) => s.shiftDate === iso)
      .map((s) => toShiftView(s, myUserId))
      .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

    return {
      date: iso,
      weekdayShort: WEEKDAYS[d.getDay()],
      dayOfMonth: d.getDate(),
      isToday: iso === todayIso,
      isPast: iso < todayIso,
      shifts: rows,
      openCount: rows.filter((s) => s.status === 'open').length,
    };
  });
}

/**
 * The number that matters on an open-signup board: how many slots nobody has
 * taken. An empty board on Sunday night means nobody unloads on Monday.
 */
export function openCount(days: readonly DayView[]): number {
  return days.reduce((n, d) => n + d.openCount, 0);
}

/** Unfilled slots for today and tomorrow. What Today should nag about. */
export function imminentOpen(days: readonly DayView[], now: Date): ShiftView[] {
  const today = toIsoDate(now);
  const tomorrow = toIsoDate(addDays(now, 1));
  return days
    .filter((d) => d.date === today || d.date === tomorrow)
    .flatMap((d) => d.shifts)
    .filter((s) => s.status === 'open');
}

/** Who is carrying the week. Completed slots count; claimed-but-not-done do not. */
export interface LoadRow {
  userId: string;
  name: string;
  claimed: number;
  completed: number;
  covering: number;
}

export function weekLoad(days: readonly DayView[]): LoadRow[] {
  const by = new Map<string, LoadRow>();
  for (const d of days) {
    for (const s of d.shifts) {
      if (!s.claimedById) continue;
      const row = by.get(s.claimedById) ?? {
        userId: s.claimedById,
        name: s.claimedByName ?? 'Someone',
        claimed: 0,
        completed: 0,
        covering: 0,
      };
      row.claimed += 1;
      if (s.status === 'done') row.completed += 1;
      if (s.covered) row.covering += 1;
      by.set(s.claimedById, row);
    }
  }
  return [...by.values()].sort((a, b) => b.claimed - a.claimed || a.name.localeCompare(b.name));
}

export function weekLabel(start: Date): string {
  const end = addDays(start, 6);
  const fmt = (d: Date) => `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}
