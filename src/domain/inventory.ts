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
// An empty set means "no constraint", which is also what "select all" produces —
// so selecting every location and selecting none give the same result, correctly.
export interface InventoryFilters {
  search?: string;
  locationIds?: readonly string[];
  categories?: readonly string[];
  stores?: readonly string[];
  onlyRestock?: boolean;
}

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
    if (locs.length > 0 && (i.locationId == null || !locs.includes(i.locationId))) return false;
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
  if (item.countMode === 'approximate') {
    return item.approximateLevel === 'low' || item.approximateLevel === 'out';
  }
  if (item.quantity == null) return false;
  if (item.minQuantity == null) return item.quantity <= 0;
  return item.quantity <= item.minQuantity;
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

// Items needing restock first, then alphabetical.
export function sortInventory(items: readonly RawInventoryItem[]): InventoryView[] {
  return items.map((i) => toInventoryView(i)).sort((a, b) => {
    if (a.needsRestock !== b.needsRestock) return a.needsRestock ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
