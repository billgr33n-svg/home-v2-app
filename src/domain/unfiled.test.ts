import { filterInventory, UNFILED, groupBy, type InventoryView } from './inventory';

// "Unfiled" is a filter over location_id IS NULL, not a place. These tests pin
// that distinction down, because the tempting shortcut -- creating a location
// row called "Unfiled" -- would let an item be filed *into* Unfiled and quietly
// destroy the signal "nobody has put this away yet".

const view = (over: Partial<InventoryView>): InventoryView => ({
  id: Math.random().toString(36).slice(2),
  name: 'Thing',
  category: 'Pantry',
  levelLabel: '1 package',
  needsRestock: false,
  approximate: false,
  level: null,
  reorderQuantity: null,
  reorderLabel: null,
  brand: null,
  store: null,
  locationId: null,
  locationName: null,
  purchasedOn: null,
  lastCountedAt: null,
  countAge: null,
  quantity: 1,
  unit: 'package',
  minQuantity: null,
  parQuantity: null,
  ...over,
});

const fridge = view({ name: 'Milk', locationId: 'L1', locationName: 'Kitchen Fridge' });
const counter = view({ name: 'Bananas', locationId: 'L2', locationName: 'Produce Counter' });
const unfiled1 = view({ name: 'Prosecco' });
const unfiled2 = view({ name: 'Burrata' });
const items = [fridge, counter, unfiled1, unfiled2];

describe('the Unfiled filter', () => {
  it('no filter shows everything, filed or not', () => {
    expect(filterInventory(items, {}).length).toBe(4);
  });

  it('Unfiled alone shows only items with no location', () => {
    const got = filterInventory(items, { locationIds: [UNFILED] });
    expect(got.map((i) => i.name).sort()).toEqual(['Burrata', 'Prosecco']);
  });

  it('a real location excludes the unfiled pile', () => {
    const got = filterInventory(items, { locationIds: ['L1'] });
    expect(got.map((i) => i.name)).toEqual(['Milk']);
  });

  it('Unfiled combines with real locations', () => {
    const got = filterInventory(items, { locationIds: ['L2', UNFILED] });
    expect(got.map((i) => i.name).sort()).toEqual(['Bananas', 'Burrata', 'Prosecco']);
  });

  it('selecting every real location WITHOUT Unfiled hides the unfiled pile', () => {
    // This is the surprise that made Unfiled necessary as an explicit option.
    const got = filterInventory(items, { locationIds: ['L1', 'L2'] });
    expect(got.length).toBe(2);
  });

  it('selecting every option INCLUDING Unfiled equals no filter', () => {
    const got = filterInventory(items, { locationIds: [UNFILED, 'L1', 'L2'] });
    expect(got.length).toBe(4);
  });

  it('the sentinel cannot collide with a real location id', () => {
    // Ids are uuids: hex and hyphens only. Underscores can never appear.
    expect(UNFILED).toContain('_');
    expect(/^[0-9a-f-]+$/i.test(UNFILED)).toBe(false);
    expect(items.every((i) => i.locationId !== UNFILED)).toBe(true);
  });
});

describe('grouping', () => {
  it('groups unfiled items together and sorts them last', () => {
    const groups = groupBy(items, 'locationName');
    expect(groups.map(([name]) => name)).toEqual(['Kitchen Fridge', 'Produce Counter', 'Unfiled']);
    expect(groups[groups.length - 1][1].length).toBe(2);
  });
});
