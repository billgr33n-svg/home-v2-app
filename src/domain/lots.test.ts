import { daysUntil, expiryLabel, freshnessOf, sortByUrgency, toLotView, useSoon, type LotView } from './lots';

// Local noon, so the local-midnight arithmetic is not sitting on a boundary.
const NOW = new Date(2026, 6, 10, 12, 0, 0); // 10 July 2026

function lot(p: Partial<LotView>): LotView {
  return {
    id: 'l', itemId: 'i', itemName: 'Milk', quantity: 1, unit: null,
    expiresOn: null, daysLeft: null, freshness: 'fresh', ...p,
  };
}

describe('daysUntil', () => {
  it('counts whole calendar days forward', () => {
    expect(daysUntil('2026-07-13', NOW)).toBe(3);
  });

  it('counts backwards for a past date', () => {
    expect(daysUntil('2026-07-08', NOW)).toBe(-2);
  });

  it('is zero for today regardless of the time of day', () => {
    expect(daysUntil('2026-07-10', new Date(2026, 6, 10, 0, 1))).toBe(0);
    expect(daysUntil('2026-07-10', new Date(2026, 6, 10, 23, 59))).toBe(0);
  });

  it('survives a spring-forward: 23 elapsed hours is still one calendar day', () => {
    // US DST begins 8 March 2026. 7 Mar -> 8 Mar is 23 hours, not 24.
    const beforeDst = new Date(2026, 2, 7, 12, 0, 0);
    expect(daysUntil('2026-03-08', beforeDst)).toBe(1);
  });

  it('survives a fall-back: 25 elapsed hours is still one calendar day', () => {
    // US DST ends 1 November 2026.
    const beforeEnd = new Date(2026, 9, 31, 12, 0, 0);
    expect(daysUntil('2026-11-01', beforeEnd)).toBe(1);
  });
});

describe('freshnessOf', () => {
  it('has no opinion about an undated lot', () => {
    expect(freshnessOf(null, NOW)).toBe('fresh');
  });

  it('classifies the boundaries', () => {
    expect(freshnessOf('2026-07-09', NOW)).toBe('expired');
    expect(freshnessOf('2026-07-10', NOW)).toBe('today');
    expect(freshnessOf('2026-07-14', NOW)).toBe('soon'); // 4 days = inside the window
    expect(freshnessOf('2026-07-15', NOW)).toBe('fresh'); // 5 days = outside
  });
});

describe('useSoon', () => {
  it('surfaces expired, today and soon, but never fresh', () => {
    const lots = [
      lot({ id: 'fresh', expiresOn: '2026-08-01', daysLeft: 22, freshness: 'fresh' }),
      lot({ id: 'soon', expiresOn: '2026-07-12', daysLeft: 2, freshness: 'soon' }),
      lot({ id: 'gone', expiresOn: '2026-07-05', daysLeft: -5, freshness: 'expired' }),
    ];
    expect(useSoon(lots).map((l) => l.id)).toEqual(['gone', 'soon']);
  });

  it('ignores a lot that has been used up, even if it is expired', () => {
    const empty = lot({ id: 'empty', quantity: 0, expiresOn: '2026-07-01', daysLeft: -9, freshness: 'expired' });
    expect(useSoon([empty])).toEqual([]);
  });
});

describe('sortByUrgency', () => {
  it('puts the most overdue first and the undated last', () => {
    const lots = [
      lot({ id: 'none' }),
      lot({ id: 'soon', daysLeft: 2 }),
      lot({ id: 'veryLate', daysLeft: -7 }),
      lot({ id: 'late', daysLeft: -1 }),
    ];
    expect(sortByUrgency(lots).map((l) => l.id)).toEqual(['veryLate', 'late', 'soon', 'none']);
  });

  it('does not mutate its input', () => {
    const lots = [lot({ id: 'b', daysLeft: 2 }), lot({ id: 'a', daysLeft: 1 })];
    sortByUrgency(lots);
    expect(lots.map((l) => l.id)).toEqual(['b', 'a']);
  });
});

describe('toLotView', () => {
  it('reads the joined item name and coerces the numeric quantity', () => {
    const v = toLotView(
      { id: 'l1', item_id: 'i1', quantity: 2 as unknown as number, unit: 'gal',
        expires_on: '2026-07-11', inventory_items: { name: 'Milk' } },
      NOW,
    );
    expect(v).toMatchObject({ itemName: 'Milk', quantity: 2, daysLeft: 1, freshness: 'soon' });
  });

  it('does not invent a name when the join is missing', () => {
    const v = toLotView({ id: 'l', item_id: 'i', quantity: 1, unit: null, expires_on: null }, NOW);
    expect(v.itemName).toBe('Unknown item');
    expect(v.freshness).toBe('fresh');
  });
});

describe('expiryLabel', () => {
  it('reads like a person wrote it', () => {
    expect(expiryLabel(lot({ daysLeft: null }))).toBe('No date');
    expect(expiryLabel(lot({ daysLeft: -3 }))).toBe('3 days past');
    expect(expiryLabel(lot({ daysLeft: -1 }))).toBe('Expired yesterday');
    expect(expiryLabel(lot({ daysLeft: 0 }))).toBe('Today');
    expect(expiryLabel(lot({ daysLeft: 1 }))).toBe('Tomorrow');
    expect(expiryLabel(lot({ daysLeft: 6 }))).toBe('6 days');
  });
});
