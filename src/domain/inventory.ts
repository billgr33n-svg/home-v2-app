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
  parQuantity: number | null;
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

export function toInventoryView(item: RawInventoryItem): InventoryView {
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
  };
}

// Items needing restock first, then alphabetical.
export function sortInventory(items: readonly RawInventoryItem[]): InventoryView[] {
  return items.map(toInventoryView).sort((a, b) => {
    if (a.needsRestock !== b.needsRestock) return a.needsRestock ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
