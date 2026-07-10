import { buildTodayFeed, type TodayInput } from './today';

const greenDay: TodayInput = {
  activeMemberCount: 5,
  rides: [{ id: 'r1', driverId: null, destination: 'Eastside Soccer Complex', pickup: 'Green Home' }],
  meals: [{ id: 'm1', title: 'Chicken tacos', respondedCount: 4 }],
  polls: [{ id: 'p1', question: 'Beach or mountains for spring break?', outstandingCount: 2, options: ['Beach', 'Mountains'] }],
  announcements: [{ id: 'a1', title: 'Plumber today 2-4pm' }],
  tasks: [{ id: 't1', title: 'Take out trash tonight', ownerName: 'Matt' }],
  maintenance: [{ id: 'mi1', title: 'Upstairs HVAC filter overdue' }],
};

describe('buildTodayFeed', () => {
  it('surfaces the unassigned ride as the top P0 decision', () => {
    const feed = buildTodayFeed(greenDay);
    expect(feed[0].kind).toBe('ride_unassigned');
    expect(feed[0].needsDecision).toBe(true);
    expect(feed[0].priority).toBe('P0');
  });

  it('flags the one missing dinner response', () => {
    const meal = buildTodayFeed(greenDay).find((i) => i.kind === 'dinner_response_needed');
    expect(meal?.detail).toBe('1 response outstanding');
    expect(meal?.needsDecision).toBe(true);
  });

  it('orders most-urgent first', () => {
    const priorities = buildTodayFeed(greenDay).map((i) => i.priority);
    expect(priorities).toEqual([...priorities].sort());
  });

  it('does not flag dinner once everyone has responded', () => {
    const feed = buildTodayFeed({ ...greenDay, meals: [{ id: 'm1', title: 'x', respondedCount: 5 }] });
    expect(feed.some((i) => i.kind === 'dinner_response_needed')).toBe(false);
  });

  it('marks an unowned task as a decision', () => {
    const feed = buildTodayFeed({ ...greenDay, tasks: [{ id: 't1', title: 'Dishes', ownerName: null }] });
    const task = feed.find((i) => i.kind === 'task_due');
    expect(task?.needsDecision).toBe(true);
    expect(task?.detail).toBe('Unassigned');
  });

  it('surfaces an open poll with votes outstanding, carrying its options for an in-place vote', () => {
    const poll = buildTodayFeed(greenDay).find((i) => i.kind === 'poll_response_needed');
    expect(poll?.needsDecision).toBe(true);
    expect(poll?.detail).toBe('2 still to answer');
    expect(poll?.options).toEqual(['Beach', 'Mountains']);
  });

  it('does not flag a poll once everyone has voted', () => {
    const feed = buildTodayFeed({
      ...greenDay,
      polls: [{ id: 'p1', question: 'x', outstandingCount: 0, options: ['a', 'b'] }],
    });
    expect(feed.some((i) => i.kind === 'poll_response_needed')).toBe(false);
  });
});
