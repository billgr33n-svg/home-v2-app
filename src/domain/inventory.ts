// Inventory: approximate quantities are valid and preferred for ordinary goods
// (PRODUCT_RULES rule 9). Exact counts are supported where the household keeps
// them. Pure domain logic. No I/O, no RN, no Supabase.

export type CountMode = 'exact' | 'approximate';
export type InventoryLevel = 'plenty' | 'some' | 'low' | 'out' | 'unknown';

export interface RawInventoryItem {
  id: string;
  name: string;
  category: string | null;
  countMode: CountMode;
  quantity: number | null;
  unit: string | null;
  approximateLevel: InventoryLevel | null;
  minQuantity: number | null;
  // Optional so that pure domain tests can build a fixture without inventing
  // provenance they don't care about.
  parQuantity?: number | null;
  brand?: string | null;
  store?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  purchasedOn?: string | null;
  lastCountedAt?: string | null;
}

export interface InventoryView {
  id: string;
  name: string;
  category: string;
  levelLabel: string;
  needsRestock: boolean;
  approximate: boolean;
  level: InventoryLevel | null;
  /** How much to buy to get back to par. Null when we can't say. */
  reorderQuantity: number | null;
  reorderLabel: string | null;
  restockReason: RestockReason | null;
  /** False when the item has no reorder point, so "running low" is unknowable. */
  hasTarget: boolean;
  brand: string | null;
  store: string | null;
  locationId: string | null;
  locationName: string | null;
  purchasedOn: string | null;
  lastCountedAt: string | null;
  /** "3 days ago" — how stale this count is. */
  countAge: string | null;
  // Raw values, so an editor can prefill without a second fetch.
  quantity: number | null;
  unit: string | null;
  minQuantity: number | null;
  parQuantity: number | null;
}

// Filters are multi-select: "show me the Kitchen Fridge AND the Garage Fridge".
// An empty set means "no constraint".
export interface InventoryFilters {
  search?: string;
  locationIds?: readonly string[];
  categories?: readonly string[];
  stores?: readonly string[];
  onlyRestock?: boolean;
}

/**
 * "Unfiled" is a filter over `location_id IS NULL`, NOT a location you can put
 * things in. The distinction matters: "nobody has filed this yet" is a different
 * fact from "this lives on the Unfiled shelf", and only the first one is a to-do.
 *
 * Making it a real location row would let an item be *assigned* to Unfiled,
 * which would quietly destroy that signal.
 */
export const UNFILED = '__unfiled__' as const;

function daysAgo(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

// Search matches name, brand and store, because people look for "Kirkland" and
// "the thing from Costco" as readily as they look for "milk".
export function filterInventory(items: readonly InventoryView[], f: InventoryFilters): InventoryView[] {
  const q = (f.search ?? '').trim().toLowerCase();
  const locs = f.locationIds ?? [];
  const cats = f.categories ?? [];
  const stores = f.stores ?? [];
  return items.filter((i) => {
    if (f.onlyRestock && !i.needsRestock) return false;
    if (locs.length > 0) {
      const matches = i.locationId == null ? locs.includes(UNFILED) : locs.includes(i.locationId);
      if (!matches) return false;
    }
    if (cats.length > 0 && !cats.includes(i.category)) return false;
    if (stores.length > 0 && (i.store == null || !stores.includes(i.store))) return false;
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) ||
      (i.brand ?? '').toLowerCase().includes(q) ||
      (i.store ?? '').toLowerCase().includes(q)
    );
  });
}

export function groupBy(items: readonly InventoryView[], key: 'locationName' | 'category'): Array<[string, InventoryView[]]> {
  const map = new Map<string, InventoryView[]>();
  for (const i of items) {
    const k = (key === 'locationName' ? i.locationName : i.category) ?? 'Unfiled';
    if (!map.has(k)) map.set(k, []);
    (map.get(k) as InventoryView[]).push(i);
  }
  return [...map.entries()].sort((a, b) => {
    if (a[0] === 'Unfiled') return 1;
    if (b[0] === 'Unfiled') return -1;
    return a[0].localeCompare(b[0]);
  });
}

// Quantities are numeric so that "half a box" is representable. Render the
// common fractions as fractions -- "0.5 package" reads like a spreadsheet,
// "½ package" reads like a pantry.
const FRACTION_LABELS: Array<[number, string]> = [
  [0.25, '¼'],
  [0.3333, '⅓'],
  [0.5, '½'],
  [0.6667, '⅔'],
  [0.75, '¾'],
];

export function formatQuantity(quantity: number, unit: string | null): string {
  const hit = FRACTION_LABELS.find(([v]) => Math.abs(v - quantity) < 0.02);
  const q = hit ? hit[1] : String(Math.round(quantity * 100) / 100);
  return unit ? `${q} ${unit}` : q;
}

const LEVEL_LABEL: Record<InventoryLevel, string> = {
  plenty: 'Plenty',
  some: 'Some',
  low: 'Low',
  out: 'Out',
  unknown: 'Unknown',
};

// The order approximate levels cycle through on tap (most to least).
export const LEVEL_CYCLE: InventoryLevel[] = ['plenty', 'some', 'low', 'out'];

export function nextLevel(current: InventoryLevel | null): InventoryLevel {
  const i = current ? LEVEL_CYCLE.indexOf(current) : -1;
  return LEVEL_CYCLE[(i + 1) % LEVEL_CYCLE.length];
}

export function inventoryLevelLabel(item: RawInventoryItem): string {
  if (item.countMode === 'exact') {
    if (item.quantity == null) return 'Unknown';
    return formatQuantity(item.quantity, item.unit);
  }
  return LEVEL_LABEL[item.approximateLevel ?? 'unknown'];
}

// "Should I buy?" is min_quantity. "How much?" is par_quantity. Two questions,
// two numbers. Without a par we can flag the item but not size the order.
export function reorderQuantity(item: RawInventoryItem): number | null {
  if (item.parQuantity == null) return null;
  const have = item.countMode === 'exact' ? item.quantity ?? 0 : item.approximateLevel === 'out' ? 0 : null;
  if (have == null) return null;
  const gap = item.parQuantity - have;
  return gap > 0 ? Math.round(gap * 100) / 100 : null;
}

export function needsRestock(item: RawInventoryItem): boolean {
  return restockReason(item) !== null;
}

/**
 * WHY an item wants buying, not just whether.
 *
 *   out_of_stock -- there is none left. True regardless of targets.
 *   below_target -- there is some left, but less than the reorder point.
 *   null         -- fine, OR we simply cannot tell.
 *
 * An item with no reorder point can only ever be judged "out". That is a real
 * limitation, not a bug: without a target, "how low is too low" is unanswerable.
 * The Shop screen surfaces the count of such items rather than silently
 * pretending they're fine.
 */
export type RestockReason = 'out_of_stock' | 'below_target';

export function restockReason(item: RawInventoryItem): RestockReason | null {
  if (item.countMode === 'approximate') {
    if (item.approximateLevel === 'out') return 'out_of_stock';
    if (item.approximateLevel === 'low') return 'below_target';
    return null;
  }
  if (item.quantity == null) return null;
  if (item.quantity <= 0) return 'out_of_stock';
  if (item.minQuantity == null) return null;
  return item.quantity <= item.minQuantity ? 'below_target' : null;
}

/** True when we have enough information to judge "running low" at all. */
export function hasReorderTarget(item: RawInventoryItem): boolean {
  return item.countMode === 'approximate' || item.minQuantity != null;
}

export function toInventoryView(item: RawInventoryItem, now: Date = new Date()): InventoryView {
  const reorder = reorderQuantity(item);
  return {
    id: item.id,
    name: item.name,
    category: item.category ?? 'Other',
    levelLabel: inventoryLevelLabel(item),
    needsRestock: needsRestock(item),
    approximate: item.countMode === 'approximate',
    level: item.countMode === 'approximate' ? item.approximateLevel ?? 'unknown' : null,
    reorderQuantity: reorder,
    reorderLabel: reorder != null ? `Buy ${formatQuantity(reorder, item.unit)}` : null,
    restockReason: restockReason(item),
    hasTarget: hasReorderTarget(item),
    brand: item.brand ?? null,
    store: item.store ?? null,
    locationId: item.locationId ?? null,
    locationName: item.locationName ?? null,
    purchasedOn: item.purchasedOn ?? null,
    lastCountedAt: item.lastCountedAt ?? null,
    countAge: daysAgo(item.lastCountedAt ?? null, now),
    quantity: item.quantity,
    unit: item.unit,
    minQuantity: item.minQuantity,
    parQuantity: item.parQuantity ?? null,
  };
}

export interface RestockList {
  /** None left. Buy these. */
  out: InventoryView[];
  /** Some left, but under the reorder point. */
  low: InventoryView[];
  /** Already sitting on the shopping list; shown as done, not as a nag. */
  onList: InventoryView[];
  /** Items we cannot judge because nobody set a reorder point. */
  untracked: number;
}

/**
 * What the Shop screen should ask you to buy.
 *
 * Items already on the shopping list are separated rather than repeated: the
 * shopping list is the decision, and once it's made, restating it as a warning
 * is noise. Matching is by name, case-insensitively, because that's the only
 * key the two tables share.
 */
export function buildRestockList(
  items: readonly InventoryView[],
  shoppingListNames: readonly string[],
): RestockList {
  const already = new Set(shoppingListNames.map((n) => n.trim().toLowerCase()));
  const out: InventoryView[] = [];
  const low: InventoryView[] = [];
  const onList: InventoryView[] = [];
  let untracked = 0;

  for (const i of items) {
    if (!i.hasTarget && i.restockReason == null) untracked += 1;
    if (i.restockReason == null) continue;
    if (already.has(i.name.trim().toLowerCase())) onList.push(i);
    else if (i.restockReason === 'out_of_stock') out.push(i);
    else low.push(i);
  }

  const byName = (a: InventoryView, b: InventoryView) => a.name.localeCompare(b.name);
  return { out: out.sort(byName), low: low.sort(byName), onList: onList.sort(byName), untracked };
}

// Items needing restock first, then alphabetical.
export function sortInventory(items: readonly RawInventoryItem[]): InventoryView[] {
  return items.map((i) => toInventoryView(i)).sort((a, b) => {
    if (a.needsRestock !== b.needsRestock) return a.needsRestock ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
