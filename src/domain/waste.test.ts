import { buildWasteReport, wasteHeadline } from './waste';

const item = (id: string, name: string, unit: string | null = null) => ({
  item_id: id,
  inventory_items: { name, unit },
});

describe('buildWasteReport', () => {
  it('keeps used and spoiled apart: that split is the whole point of the ledger', () => {
    const r = buildWasteReport([
      { ...item('a', 'Cilantro'), delta: -2, reason: 'spoiled' },
      { ...item('a', 'Cilantro'), delta: -1, reason: 'used' },
    ]);
    expect(r.rows[0]).toMatchObject({ itemName: 'Cilantro', spoiledUnits: 2, usedUnits: 1, spoiledEvents: 1 });
    expect(r.totalSpoiledUnits).toBe(2);
    expect(r.totalUsedUnits).toBe(1);
  });

  it('counts scrapped as waste, not as use', () => {
    const r = buildWasteReport([{ ...item('a', 'Bread'), delta: -1, reason: 'scrapped' }]);
    expect(r.totalSpoiledUnits).toBe(1);
    expect(r.totalUsedUnits).toBe(0);
  });

  it('ignores inflows and adjustments', () => {
    const r = buildWasteReport([
      { ...item('a', 'Milk'), delta: 4, reason: 'purchased' },
      { ...item('a', 'Milk'), delta: -1, reason: 'adjusted' },
      { ...item('a', 'Milk'), delta: 2, reason: 'counted' },
    ]);
    expect(r.rows).toEqual([]);
    expect(r.wasteShare).toBeNull();
  });

  it('takes the absolute value: a movement of -3 is three units', () => {
    const r = buildWasteReport([{ ...item('a', 'Eggs'), delta: -3, reason: 'spoiled' }]);
    expect(r.totalSpoiledUnits).toBe(3);
  });

  it('coerces a numeric string from PostgREST', () => {
    const r = buildWasteReport([{ ...item('a', 'Eggs'), delta: '-3' as unknown as number, reason: 'spoiled' }]);
    expect(r.totalSpoiledUnits).toBe(3);
  });

  it('drops zero and non-finite deltas rather than charting them', () => {
    const r = buildWasteReport([
      { ...item('a', 'Eggs'), delta: 0, reason: 'spoiled' },
      { ...item('b', 'Rice'), delta: NaN, reason: 'spoiled' },
    ]);
    expect(r.rows).toEqual([]);
  });

  it('ranks by units spoiled, breaking ties alphabetically', () => {
    const r = buildWasteReport([
      { ...item('b', 'Basil'), delta: -1, reason: 'spoiled' },
      { ...item('a', 'Arugula'), delta: -1, reason: 'spoiled' },
      { ...item('c', 'Carrots'), delta: -5, reason: 'spoiled' },
    ]);
    expect(r.rows.map((x) => x.itemName)).toEqual(['Carrots', 'Arugula', 'Basil']);
    expect(r.worst?.itemName).toBe('Carrots');
  });

  it('computes waste as a share of everything that left, not of stock', () => {
    const r = buildWasteReport([
      { ...item('a', 'Milk'), delta: -1, reason: 'spoiled' },
      { ...item('a', 'Milk'), delta: -3, reason: 'used' },
    ]);
    expect(r.wasteShare).toBeCloseTo(0.25);
  });

  it('has no worst offender when nothing spoiled', () => {
    const r = buildWasteReport([{ ...item('a', 'Milk'), delta: -3, reason: 'used' }]);
    expect(r.worst).toBeNull();
    expect(r.wasteShare).toBe(0);
  });

  it('does not invent a name when the join is missing', () => {
    const r = buildWasteReport([{ item_id: 'x', delta: -1, reason: 'spoiled' }]);
    expect(r.rows[0].itemName).toBe('Unknown item');
  });
});

describe('wasteHeadline', () => {
  it('says nothing happened when nothing happened', () => {
    expect(wasteHeadline(buildWasteReport([]), 'this month')).toBe('Nothing recorded this month.');
  });

  it('celebrates a clean month without inventing a percentage', () => {
    const r = buildWasteReport([{ ...item('a', 'Milk'), delta: -3, reason: 'used' }]);
    expect(wasteHeadline(r, 'this month')).toBe('Nothing thrown away this month.');
  });

  it('names the worst offender, because a vague number changes nothing', () => {
    const r = buildWasteReport([
      { ...item('a', 'Cilantro'), delta: -3, reason: 'spoiled' },
      { ...item('b', 'Rice'), delta: -1, reason: 'used' },
    ]);
    expect(wasteHeadline(r, 'this month')).toBe(
      '75% of what left the house this month was thrown away, mostly cilantro.',
    );
  });
});
