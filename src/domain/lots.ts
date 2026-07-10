/**
 * Freshness. Pure functions, no network, no clock of their own.
 *
 * `now` is always passed in. A "days left" calculation that reads the clock
 * internally is untestable and, worse, wrong across a DST boundary or when the
 * user's device is in a different timezone from the one that wrote the date.
 *
 * Expiry dates are calendar dates (`date`, not `timestamptz`). Milk expires on
 * the 13th everywhere on earth. So all arithmetic here is done on LOCAL calendar
 * days, never on elapsed milliseconds -- 23 hours across a spring-forward is
 * still one day.
 */

export type Freshness = 'expired' | 'today' | 'soon' | 'fresh';

/** Anything at or inside this window is worth surfacing on Today. */
export const SOON_DAYS = 4;

export interface LotView {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string | null;
  expiresOn: string | null; // 'YYYY-MM-DD'
  daysLeft: number | null;
  freshness: Freshness;
}

/** Local calendar midnight for a 'YYYY-MM-DD' string. */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function localMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days from `now` to `iso`. Negative means already past. */
export function daysUntil(iso: string, now: Date): number {
  const a = localMidnight(now).getTime();
  const b = parseLocalDate(iso).getTime();
  // Both are local midnights, so the difference is a whole number of days even
  // across DST once we round -- the offset shift is at most an hour.
  return Math.round((b - a) / 86_400_000);
}

export function freshnessOf(iso: string | null, now: Date): Freshness {
  if (!iso) return 'fresh';
  const d = daysUntil(iso, now);
  if (d < 0) return 'expired';
  if (d === 0) return 'today';
  if (d <= SOON_DAYS) return 'soon';
  return 'fresh';
}

export function toLotView(
  row: {
    id: string;
    item_id: string;
    quantity: number;
    unit: string | null;
    expires_on: string | null;
    inventory_items?: { name: string } | null;
  },
  now: Date,
): LotView {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.inventory_items?.name ?? 'Unknown item',
    quantity: Number(row.quantity),
    unit: row.unit,
    expiresOn: row.expires_on,
    daysLeft: row.expires_on ? daysUntil(row.expires_on, now) : null,
    freshness: freshnessOf(row.expires_on, now),
  };
}

/** Expired first (most overdue at the top), then soonest. Undated last. */
export function sortByUrgency(lots: readonly LotView[]): LotView[] {
  return [...lots].sort((a, b) => {
    if (a.daysLeft === null && b.daysLeft === null) return a.itemName.localeCompare(b.itemName);
    if (a.daysLeft === null) return 1;
    if (b.daysLeft === null) return -1;
    return a.daysLeft - b.daysLeft;
  });
}

/** What Today shows: anything expired, due today, or due within SOON_DAYS. */
export function useSoon(lots: readonly LotView[]): LotView[] {
  return sortByUrgency(lots.filter((l) => l.quantity > 0 && l.freshness !== 'fresh'));
}

export function expiryLabel(lot: LotView): string {
  if (lot.daysLeft === null) return 'No date';
  if (lot.daysLeft < -1) return `${Math.abs(lot.daysLeft)} days past`;
  if (lot.daysLeft === -1) return 'Expired yesterday';
  if (lot.daysLeft === 0) return 'Today';
  if (lot.daysLeft === 1) return 'Tomorrow';
  return `${lot.daysLeft} days`;
}
