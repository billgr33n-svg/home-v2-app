// Pure re-implementations of the delta math in api/movements.ts, so the rules
// are pinned without a network. If these drift from the API, the API is wrong.

interface Countable {
  id: string;
  quantity: number | null;
}

const setAmountDeltas = (items: Countable[], to: number) =>
  items.map((i) => ({ id: i.id, delta: to - (i.quantity ?? 0) })).filter((r) => r.delta !== 0);

const consumeDeltas = (items: Countable[], each: number) =>
  items
    .map((i) => {
      const have = i.quantity ?? 0;
      return { id: i.id, delta: -Math.min(Math.abs(each), have) };
    })
    .filter((r) => r.delta !== 0);

const discardDeltas = (items: Countable[]) =>
  items.map((i) => ({ id: i.id, delta: -(i.quantity ?? 0) })).filter((r) => r.delta !== 0);

describe('bulk set amount records a per-item delta, not a shared one', () => {
  it('computes the difference for each item separately', () => {
    const items = [
      { id: 'a', quantity: 0 },
      { id: 'b', quantity: 1 },
      { id: 'c', quantity: 5 },
    ];
    expect(setAmountDeltas(items, 2)).toEqual([
      { id: 'a', delta: 2 },
      { id: 'b', delta: 1 },
      { id: 'c', delta: -3 },
    ]);
  });

  it('skips items already at the target: nothing happened, so nothing is logged', () => {
    const items = [
      { id: 'a', quantity: 2 },
      { id: 'b', quantity: 3 },
    ];
    expect(setAmountDeltas(items, 2)).toEqual([{ id: 'b', delta: -1 }]);
  });

  it('treats a null quantity as zero', () => {
    expect(setAmountDeltas([{ id: 'a', quantity: null }], 1)).toEqual([{ id: 'a', delta: 1 }]);
  });
});

describe('bulk consume never takes more than an item has', () => {
  it('clamps per item rather than going negative', () => {
    const items = [
      { id: 'plenty', quantity: 5 },
      { id: 'scarce', quantity: 0.5 },
      { id: 'empty', quantity: 0 },
    ];
    // Ask for 1 from each. The scarce item yields 0.5; the empty one yields nothing.
    expect(consumeDeltas(items, 1)).toEqual([
      { id: 'plenty', delta: -1 },
      { id: 'scarce', delta: -0.5 },
    ]);
  });

  it('a negative "amount each" is still a removal, not an addition', () => {
    expect(consumeDeltas([{ id: 'a', quantity: 3 }], -2)).toEqual([{ id: 'a', delta: -2 }]);
  });
});

describe('bulk discard empties each item exactly', () => {
  it('removes exactly what is on hand', () => {
    const items = [
      { id: 'a', quantity: 1.82 },
      { id: 'b', quantity: 2 },
      { id: 'gone', quantity: 0 },
    ];
    expect(discardDeltas(items)).toEqual([
      { id: 'a', delta: -1.82 },
      { id: 'b', delta: -2 },
    ]);
  });
});
