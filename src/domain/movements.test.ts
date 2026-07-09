import { formatQuantity, needsRestock, reorderQuantity, type RawInventoryItem } from './inventory';

// A movement ledger is only useful if the balance it produces drives the right
// decisions. These are the decisions.

const item = (over: Partial<RawInventoryItem>): RawInventoryItem => ({
  id: 'i1',
  name: 'Milk',
  category: 'Dairy',
  countMode: 'exact',
  quantity: 1,
  unit: 'gal',
  approximateLevel: null,
  minQuantity: null,
  ...over,
});

describe('balance drives restocking', () => {
  it('an item used down to zero needs restocking', () => {
    expect(needsRestock(item({ quantity: 0 }))).toBe(true);
  });

  it('an item at its reorder point needs restocking', () => {
    expect(needsRestock(item({ quantity: 0.5, minQuantity: 0.5 }))).toBe(true);
  });

  it('an item above its reorder point does not', () => {
    expect(needsRestock(item({ quantity: 2, minQuantity: 0.5 }))).toBe(false);
  });

  it('spoiling the last of something leaves it needing restock, not deleted', () => {
    // 'spoiled' takes the balance to 0; the item still exists and wants buying.
    const afterSpoilage = item({ quantity: 0, minQuantity: 1, parQuantity: 2 });
    expect(needsRestock(afterSpoilage)).toBe(true);
    expect(reorderQuantity(afterSpoilage)).toBe(2);
  });
});

describe('reorder quantity closes the gap to par', () => {
  it('buys the difference between on-hand and par', () => {
    expect(reorderQuantity(item({ quantity: 0.5, parQuantity: 2 }))).toBe(1.5);
  });

  it('says nothing when already at par', () => {
    expect(reorderQuantity(item({ quantity: 2, parQuantity: 2 }))).toBeNull();
  });

  it('cannot size an order without a par level', () => {
    expect(reorderQuantity(item({ quantity: 0, parQuantity: null }))).toBeNull();
  });
});

describe('fractions read like a pantry, not a spreadsheet', () => {
  it.each([
    [0.5, '½ package'],
    [0.25, '¼ package'],
    [0.3333, '⅓ package'],
    [0.75, '¾ package'],
  ])('renders %p as %p', (qty, expected) => {
    expect(formatQuantity(qty as number, 'package')).toBe(expected);
  });

  it('leaves ordinary numbers alone', () => {
    expect(formatQuantity(1.82, 'lb')).toBe('1.82 lb');
    expect(formatQuantity(2, 'bottle')).toBe('2 bottle');
  });
});
