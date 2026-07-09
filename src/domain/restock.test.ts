import {
  buildRestockList,
  hasReorderTarget,
  restockReason,
  toInventoryView,
  type RawInventoryItem,
} from './inventory';

const raw = (over: Partial<RawInventoryItem>): RawInventoryItem => ({
  id: Math.random().toString(36).slice(2),
  name: 'Thing',
  category: 'Pantry',
  countMode: 'exact',
  quantity: 1,
  unit: 'package',
  approximateLevel: null,
  minQuantity: null,
  ...over,
});

describe('restockReason distinguishes "gone" from "running low"', () => {
  it('an empty item is out of stock, target or no target', () => {
    expect(restockReason(raw({ quantity: 0 }))).toBe('out_of_stock');
    expect(restockReason(raw({ quantity: 0, minQuantity: 2 }))).toBe('out_of_stock');
  });

  it('an item at or under its reorder point is below target', () => {
    expect(restockReason(raw({ quantity: 0.5, minQuantity: 0.5 }))).toBe('below_target');
    expect(restockReason(raw({ quantity: 0.25, minQuantity: 0.5 }))).toBe('below_target');
  });

  it('an item above its reorder point is fine', () => {
    expect(restockReason(raw({ quantity: 3, minQuantity: 1 }))).toBeNull();
  });

  it('WITHOUT a reorder point, "running low" is unknowable — only empty counts', () => {
    // This is the honest answer, not a bug. 1 package of flour might be plenty
    // or nearly nothing; without a target the app cannot say which.
    expect(restockReason(raw({ quantity: 1, minQuantity: null }))).toBeNull();
    expect(hasReorderTarget(raw({ minQuantity: null }))).toBe(false);
    expect(hasReorderTarget(raw({ minQuantity: 1 }))).toBe(true);
  });

  it('approximate levels map onto the same two reasons', () => {
    expect(restockReason(raw({ countMode: 'approximate', quantity: null, approximateLevel: 'out' }))).toBe('out_of_stock');
    expect(restockReason(raw({ countMode: 'approximate', quantity: null, approximateLevel: 'low' }))).toBe('below_target');
    expect(restockReason(raw({ countMode: 'approximate', quantity: null, approximateLevel: 'plenty' }))).toBeNull();
    // An approximate item is always judgeable: "low" is itself the target.
    expect(hasReorderTarget(raw({ countMode: 'approximate', minQuantity: null }))).toBe(true);
  });
});

describe('buildRestockList is what the Shop tab shows', () => {
  const view = (o: Partial<RawInventoryItem>) => toInventoryView(raw(o));

  const milk = view({ name: 'Milk', quantity: 0 });
  const eggs = view({ name: 'Eggs', quantity: 0.5, minQuantity: 1 });
  const flour = view({ name: 'Flour', quantity: 1 }); // no target
  const rice = view({ name: 'Rice', quantity: 5, minQuantity: 1 }); // fine
  const items = [milk, eggs, flour, rice];

  it('splits out-of-stock from below-target and ignores healthy items', () => {
    const r = buildRestockList(items, []);
    expect(r.out.map((i) => i.name)).toEqual(['Milk']);
    expect(r.low.map((i) => i.name)).toEqual(['Eggs']);
    expect(r.onList).toEqual([]);
  });

  it('counts the items it cannot judge rather than hiding them', () => {
    const r = buildRestockList(items, []);
    expect(r.untracked).toBe(1); // Flour: has stock, no reorder point
  });

  it('does not nag about something already on the shopping list', () => {
    const r = buildRestockList(items, ['milk']);
    expect(r.out).toEqual([]);
    expect(r.onList.map((i) => i.name)).toEqual(['Milk']);
  });

  it('matches the shopping list case-insensitively and ignores whitespace', () => {
    const r = buildRestockList(items, ['  MiLk  ']);
    expect(r.onList.map((i) => i.name)).toEqual(['Milk']);
  });

  it('a healthy item never appears, even if it is on the shopping list', () => {
    const r = buildRestockList(items, ['rice']);
    expect([...r.out, ...r.low, ...r.onList].map((i) => i.name)).not.toContain('Rice');
  });
});
