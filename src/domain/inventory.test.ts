import { sortInventory, needsRestock, inventoryLevelLabel, nextLevel, type RawInventoryItem } from './inventory';

// Mirrors the M5 seed pantry: three items below threshold, two fine.
const pantry: RawInventoryItem[] = [
  { id: 'milk', name: 'Milk', category: 'Dairy', countMode: 'approximate', quantity: null, unit: null, approximateLevel: 'low', minQuantity: null },
  { id: 'eggs', name: 'Eggs', category: 'Dairy', countMode: 'exact', quantity: 3, unit: 'count', approximateLevel: null, minQuantity: 6 },
  { id: 'tortillas', name: 'Tortillas', category: 'Pantry', countMode: 'exact', quantity: 12, unit: 'count', approximateLevel: null, minQuantity: 6 },
  { id: 'coffee', name: 'Coffee', category: 'Pantry', countMode: 'approximate', quantity: null, unit: null, approximateLevel: 'plenty', minQuantity: null },
  { id: 'soap', name: 'Dish soap', category: 'Household', countMode: 'approximate', quantity: null, unit: null, approximateLevel: 'out', minQuantity: null },
];

describe('inventory', () => {
  it('flags low/out approximate items and exact items at or below min', () => {
    expect(needsRestock(pantry[0])).toBe(true); // milk: low
    expect(needsRestock(pantry[1])).toBe(true); // eggs: 3 <= 6
    expect(needsRestock(pantry[2])).toBe(false); // tortillas: 12 > 6
    expect(needsRestock(pantry[3])).toBe(false); // coffee: plenty
    expect(needsRestock(pantry[4])).toBe(true); // soap: out
  });

  it('labels exact quantities and approximate levels', () => {
    expect(inventoryLevelLabel(pantry[1])).toBe('3 count');
    expect(inventoryLevelLabel(pantry[0])).toBe('Low');
    expect(inventoryLevelLabel(pantry[3])).toBe('Plenty');
  });

  it('sorts the three restock-needed items first', () => {
    const v = sortInventory(pantry);
    expect(v.filter((i) => i.needsRestock).length).toBe(3);
    expect(v.slice(0, 3).every((i) => i.needsRestock)).toBe(true);
  });

  it('cycles approximate levels plenty -> some -> low -> out -> plenty', () => {
    expect(nextLevel('plenty')).toBe('some');
    expect(nextLevel('out')).toBe('plenty');
    expect(nextLevel(null)).toBe('plenty');
  });
});
