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
}

export interface InventoryView {
  id: string;
  name: string;
  category: string;
  levelLabel: string;
  needsRestock: boolean;
  approximate: boolean;
  level: InventoryLevel | null;
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
    return item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity);
  }
  return LEVEL_LABEL[item.approximateLevel ?? 'unknown'];
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
  return {
    id: item.id,
    name: item.name,
    category: item.category ?? 'Other',
    levelLabel: inventoryLevelLabel(item),
    needsRestock: needsRestock(item),
    approximate: item.countMode === 'approximate',
    level: item.countMode === 'approximate' ? item.approximateLevel ?? 'unknown' : null,
  };
}

// Items needing restock first, then alphabetical.
export function sortInventory(items: readonly RawInventoryItem[]): InventoryView[] {
  return items.map(toInventoryView).sort((a, b) => {
    if (a.needsRestock !== b.needsRestock) return a.needsRestock ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
