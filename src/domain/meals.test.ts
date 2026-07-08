import { summarizeDinner, dinnerResponseLabel, dinnerSummaryLabel, type DinnerMemberResponse } from './meals';

// Mirrors the Green seed day: 5 active members, 4 responded, Cora outstanding.
const members = ['bill', 'sandy', 'will', 'matt', 'cora'];
const seedResponses: DinnerMemberResponse[] = [
  { userId: 'bill', response: 'home' },
  { userId: 'sandy', response: 'home' },
  { userId: 'will', response: 'home' },
  { userId: 'matt', response: 'away' },
];

describe('summarizeDinner', () => {
  it('flags Cora as the one outstanding response', () => {
    const s = summarizeDinner(members, seedResponses);
    expect(s.respondedCount).toBe(4);
    expect(s.outstandingIds).toEqual(['cora']);
    expect(s.complete).toBe(false);
  });

  it('counts three home and one away for the seed day', () => {
    const s = summarizeDinner(members, seedResponses);
    expect(s.homeCount).toBe(3);
    expect(s.awayCount).toBe(1);
    expect(s.headcount).toBe(3);
  });

  it('completes once Cora answers home', () => {
    const s = summarizeDinner(members, [...seedResponses, { userId: 'cora', response: 'home' }]);
    expect(s.complete).toBe(true);
    expect(s.outstandingIds).toEqual([]);
    expect(s.headcount).toBe(4);
  });

  it('adds guests to the headcount without overcounting members', () => {
    const s = summarizeDinner(members, [...seedResponses, { userId: 'cora', response: 'guest', guestCount: 2 }]);
    expect(s.headcount).toBe(6); // 3 home + Cora (1) + 2 guests
    expect(s.homeCount).toBe(4);
  });

  it('ignores responses from users who are not members', () => {
    const s = summarizeDinner(members, [...seedResponses, { userId: 'stranger', response: 'home' }]);
    expect(s.respondedCount).toBe(4);
    expect(s.outstandingIds).toEqual(['cora']);
  });

  it('produces human labels', () => {
    expect(dinnerResponseLabel('save_plate')).toBe('Save a plate');
    expect(dinnerResponseLabel('home')).toBe('Home');
    expect(dinnerSummaryLabel(summarizeDinner(members, seedResponses))).toContain('to answer');
    expect(dinnerSummaryLabel(summarizeDinner(members, [...seedResponses, { userId: 'cora', response: 'home' }]))).toContain('All answered');
  });
});
