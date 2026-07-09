// Weekly meal plan. Pure domain logic: no I/O, no RN, no Supabase.
//
// The plan is a 7 x 3 grid (day x slot). A slot with no meal is "OYO" -- on your
// own. That is the default state of the world, so we never store OYO rows; we
// just fail to find a meal and say so. Deleting a meal returns the slot to OYO.

export type Slot = 'breakfast' | 'lunch' | 'dinner';
export const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];
export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export interface RawPlannedMeal {
  id: string;
  title: string;
  slot: Slot;
  /** ISO timestamp. */
  plannedAt: string;
  status: string;
  cookId: string | null;
  cookName: string | null;
}

export interface SlotView {
  slot: Slot;
  label: string;
  /** null => OYO. */
  meal: RawPlannedMeal | null;
  cookLabel: string;
  isOyo: boolean;
}

export interface DayView {
  /** YYYY-MM-DD */
  date: string;
  weekdayShort: string;
  dayOfMonth: number;
  isToday: boolean;
  slots: SlotView[];
  plannedCount: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local-date key, not UTC — a meal at 6pm Sunday must not land on Monday. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday-first week containing `d`. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = out.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  out.setDate(out.getDate() + diff);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

export function weekRange(weekStart: Date): { from: Date; to: Date } {
  return { from: weekStart, to: addDays(weekStart, 7) };
}

export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const fmt = (d: Date, withMonth: boolean) =>
    withMonth ? `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}` : String(d.getDate());
  return `${fmt(weekStart, true)} – ${fmt(end, !sameMonth)}`;
}

function cookLabelFor(meal: RawPlannedMeal | null): string {
  if (!meal) return 'On your own';
  if (!meal.cookId) return 'No cook yet';
  return `Cook: ${meal.cookName ?? 'Someone'}`;
}

/** Build the 7-day grid. Meals not in the week are ignored. */
export function buildWeek(weekStart: Date, meals: readonly RawPlannedMeal[], now: Date = new Date()): DayView[] {
  const byDaySlot = new Map<string, RawPlannedMeal>();
  for (const m of meals) {
    const key = `${dateKey(new Date(m.plannedAt))}|${m.slot}`;
    // First one wins; the DB enforces one per slot anyway.
    if (!byDaySlot.has(key)) byDaySlot.set(key, m);
  }

  const todayKey = dateKey(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const key = dateKey(d);
    const slots: SlotView[] = SLOTS.map((slot) => {
      const meal = byDaySlot.get(`${key}|${slot}`) ?? null;
      return { slot, label: SLOT_LABEL[slot], meal, cookLabel: cookLabelFor(meal), isOyo: meal === null };
    });
    return {
      date: key,
      weekdayShort: WEEKDAYS[d.getDay()],
      dayOfMonth: d.getDate(),
      isToday: key === todayKey,
      slots,
      plannedCount: slots.filter((s) => !s.isOyo).length,
    };
  });
}

/** Meals default to sensible hours so ordering by time is meaningful. */
const SLOT_HOUR: Record<Slot, number> = { breakfast: 8, lunch: 12, dinner: 18 };

export function plannedAtFor(date: string, slot: Slot): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, SLOT_HOUR[slot], 0, 0).toISOString();
}
