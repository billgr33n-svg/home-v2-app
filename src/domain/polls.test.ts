import { tallyLabel, tallyPoll } from './polls';

describe('polls domain', () => {
  it('lists who has not responded', () => {
    const t = tallyPoll({ memberIds: ['a', 'b', 'c', 'd', 'e'], responderIds: ['a', 'b', 'd'] });
    expect(t.respondedCount).toBe(3);
    expect(t.notRespondedIds).toEqual(['c', 'e']);
    expect(t.complete).toBe(false);
    expect(tallyLabel(t)).toBe('3 of 5 responded');
  });

  it('reports complete when everyone responded', () => {
    const t = tallyPoll({ memberIds: ['a', 'b'], responderIds: ['b', 'a'] });
    expect(t.complete).toBe(true);
    expect(tallyLabel(t)).toBe('All responded');
  });
});
