import {
  comparePriority,
  priorityForKind,
  sortByPriority,
} from './priority';

describe('notification priority', () => {
  it('maps a ride escalation to P0', () => {
    expect(priorityForKind('ride_escalation')).toBe('P0');
  });

  it('maps announcements to P2', () => {
    expect(priorityForKind('announcement')).toBe('P2');
  });

  it('orders P0 before P1 before P2', () => {
    expect(comparePriority('P0', 'P1')).toBeLessThan(0);
    expect(comparePriority('P2', 'P0')).toBeGreaterThan(0);
    expect(comparePriority('P1', 'P1')).toBe(0);
  });

  it('sorts a mixed list most-urgent first', () => {
    const sorted = sortByPriority([
      { id: 'a', priority: 'P2' as const },
      { id: 'b', priority: 'P0' as const },
      { id: 'c', priority: 'P1' as const },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });
});
