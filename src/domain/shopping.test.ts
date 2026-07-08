import { buildShoppingList, isDone, toShoppingView, type RawShoppingItem } from './shopping';

// Mirrors the M5 seed shopping list: two open, one done.
const items: RawShoppingItem[] = [
  { id: 'milk', name: 'Milk', quantity: 2, unit: 'gal', store: 'Kroger', state: 'new' },
  { id: 'candles', name: 'Birthday candles', quantity: null, unit: null, store: null, state: 'new' },
  { id: 'towels', name: 'Paper towels', quantity: null, unit: null, store: null, state: 'completed' },
];

describe('shopping', () => {
  it('splits open from done', () => {
    const l = buildShoppingList(items);
    expect(l.openCount).toBe(2);
    expect(l.open.map((i) => i.name)).toEqual(['Milk', 'Birthday candles']);
    expect(l.done.map((i) => i.name)).toEqual(['Paper towels']);
  });

  it('builds a detail line from quantity, unit, and store', () => {
    expect(toShoppingView(items[0]).detail).toBe('2 gal · Kroger');
    expect(toShoppingView(items[1]).detail).toBe(null);
  });

  it('treats completed, declined, and canceled as done', () => {
    expect(isDone('completed')).toBe(true);
    expect(isDone('canceled')).toBe(true);
    expect(isDone('new')).toBe(false);
  });
});
