import { openTaskViews, taskStatusLabel, toTaskView, type RawTask } from './tasks';

// Mirrors the M6 seed: an assigned chore, an Unassigned task, a recurring chore,
// and a completed one that should be filtered out.
const tasks: RawTask[] = [
  { id: 'trash', title: 'Take out trash tonight', state: 'not_started', ownerId: 'matt', ownerName: 'Matt', priority: 'normal', dueAt: null, recurrenceRule: null, version: 1 },
  { id: 'garden', title: 'Water the front garden', state: 'not_started', ownerId: null, ownerName: null, priority: 'high', dueAt: null, recurrenceRule: null, version: 1 },
  { id: 'kitchen', title: 'Kitchen trash and recycling', state: 'not_started', ownerId: 'matt', ownerName: 'Matt', priority: 'normal', dueAt: null, recurrenceRule: 'weekly', version: 1 },
  { id: 'done', title: 'Old task', state: 'completed', ownerId: 'bill', ownerName: 'Bill', priority: 'low', dueAt: null, recurrenceRule: null, version: 3 },
];

describe('tasks', () => {
  it('excludes completed/verified/canceled/skipped from the open list', () => {
    const v = openTaskViews(tasks);
    expect(v.map((t) => t.id)).not.toContain('done');
    expect(v.length).toBe(3);
  });

  it('lists Unassigned tasks first', () => {
    const v = openTaskViews(tasks);
    expect(v[0].id).toBe('garden');
    expect(v[0].unassigned).toBe(true);
    expect(v[0].ownerLabel).toBe('Unassigned');
  });

  it('labels an owner when assigned', () => {
    expect(toTaskView(tasks[0]).ownerLabel).toBe('Matt');
    expect(toTaskView(tasks[0]).unassigned).toBe(false);
  });

  it('flags recurring tasks', () => {
    expect(toTaskView(tasks[2]).recurring).toBe(true);
    expect(toTaskView(tasks[0]).recurring).toBe(false);
  });

  it('maps state to a human status', () => {
    expect(taskStatusLabel('in_progress')).toBe('In progress');
    expect(taskStatusLabel('not_started')).toBe('Not started');
  });
});
