import { buildInventoryPrompt, selectForExport } from './exportInventory';
import type { InventoryView } from './inventory';

const NOW = new Date(2026, 6, 10, 12, 0, 0);

function item(p: Partial<InventoryView> & { name: string; category: string }): InventoryView {
  return {
    id: p.name, levelLabel: '', needsRestock: false, approximate: false, level: null,
    reorderQuantity: null, reorderLabel: null, restockReason: null, hasTarget: false,
    brand: null, store: null, locationId: null, locationName: null, purchasedOn: null,
    lastCountedAt: null, countAge: null, quantity: 1, unit: null, minQuantity: null,
    parQuantity: null, ...p,
  } as InventoryView;
}

describe('selectForExport', () => {
  it('keeps food out of the bar list and bar out of the food list', () => {
    const gin = item({ name: 'Gin', category: 'Alcohol' });
    const eggs = item({ name: 'Eggs', category: 'Dairy' });

    expect(selectForExport([gin, eggs], 'food').map((i) => i.name)).toEqual(['Eggs']);
    expect(selectForExport([gin, eggs], 'bar').map((i) => i.name)).toEqual(['Gin']);
  });

  it('treats anything in a liquor/wine/mixer location as bar stock, whatever its category', () => {
    const bitters = item({ name: 'Bitters', category: 'Pantry', locationName: 'Mixer Cabinet' });
    expect(selectForExport([bitters], 'bar').map((i) => i.name)).toEqual(['Bitters']);
    // ...and therefore NOT in the food list, even though its category says Pantry.
    expect(selectForExport([bitters], 'food')).toEqual([]);
  });

  it('recognises the real location names in this household', () => {
    const names = ['Liquor', 'Wine Rack', 'Basement Alcohol', 'Mixer Cabinet'];
    for (const locationName of names) {
      const it = item({ name: 'X', category: 'Pantry', locationName });
      expect(selectForExport([it], 'bar')).toHaveLength(1);
    }
  });

  it('does not mistake "Bread Drawer" for a bar just because it contains letters', () => {
    const bread = item({ name: 'Sourdough', category: 'Bakery', locationName: 'Bread Drawer' });
    expect(selectForExport([bread], 'bar')).toEqual([]);
    expect(selectForExport([bread], 'food')).toHaveLength(1);
  });

  it('sends the whole produce drawer to the bar rather than guessing at fruit', () => {
    const lime = item({ name: 'Limes', category: 'Produce' });
    const kale = item({ name: 'Kale', category: 'Produce' });
    expect(selectForExport([lime, kale], 'bar').map((i) => i.name)).toEqual(['Limes', 'Kale']);
  });

  it('puts beverages in both lists: tonic mixes a drink, tonic is also in the fridge', () => {
    const tonic = item({ name: 'Tonic', category: 'Beverages' });
    expect(selectForExport([tonic], 'bar')).toHaveLength(1);
    expect(selectForExport([tonic], 'food')).toHaveLength(1);
  });

  it('never exports dish soap or ibuprofen to a recipe prompt', () => {
    const soap = item({ name: 'Dish soap', category: 'Household' });
    const meds = item({ name: 'Ibuprofen', category: 'Health' });
    expect(selectForExport([soap, meds], 'food')).toEqual([]);
    expect(selectForExport([soap, meds], 'bar')).toEqual([]);
  });
});

describe('buildInventoryPrompt', () => {
  it('separates out-of-stock so the model does not build a meal around missing milk', () => {
    const milk = item({ name: 'Milk', category: 'Dairy', approximate: true, level: 'out', quantity: null });
    const eggs = item({ name: 'Eggs', category: 'Dairy', quantity: 3, unit: 'count' });

    const text = buildInventoryPrompt([milk, eggs], 'food', NOW);
    expect(text).toContain('- Eggs — 3 count');
    expect(text).toContain('## Out of stock (do not build around these)');
    expect(text).toContain('- Milk');
    // Milk must not appear as if it were on hand.
    expect(text).not.toContain('- Milk — ');
  });

  it('passes approximate levels through as words, never as invented numbers', () => {
    const oil = item({ name: 'Olive oil', category: 'Pantry', approximate: true, level: 'some', quantity: null });
    expect(buildInventoryPrompt([oil], 'food', NOW)).toContain('- Olive oil — some');
  });

  it('says "amount unknown" rather than guessing', () => {
    const rice = item({ name: 'Rice', category: 'Pantry', quantity: null });
    expect(buildInventoryPrompt([rice], 'food', NOW)).toContain('- Rice — amount unknown');
  });

  it('includes brand and location when known', () => {
    const b = item({ name: 'Butter', category: 'Dairy', brand: 'Kerrygold', quantity: 2, unit: 'sticks', locationName: 'Kitchen Fridge' });
    expect(buildInventoryPrompt([b], 'food', NOW)).toContain('- Butter (Kerrygold) — 2 sticks, Kitchen Fridge');
  });

  it('orders sections the way a cook thinks, not alphabetically', () => {
    const text = buildInventoryPrompt(
      [item({ name: 'Chips', category: 'Snacks' }), item({ name: 'Apples', category: 'Produce' })],
      'food',
      NOW,
    );
    expect(text.indexOf('## Produce')).toBeLessThan(text.indexOf('## Snacks'));
  });

  it('stamps the date so a stale paste is obvious', () => {
    expect(buildInventoryPrompt([], 'food', NOW)).toContain('2026-07-10');
  });

  it('does not pretend to have a pantry when it is empty', () => {
    expect(buildInventoryPrompt([], 'food', NOW)).toContain('(Nothing on hand.)');
  });

  it('tells the model the produce list is unfiltered, so it does not muddle kale', () => {
    expect(buildInventoryPrompt([], 'bar', NOW)).toContain('ignore anything that is obviously not a cocktail');
  });
});
