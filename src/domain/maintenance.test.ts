import { sortSchedules, dueReminders, toMaintenanceView, type RawSchedule } from './maintenance';

const today = '2026-07-05';
// Mirrors the M7 seed: overdue (today-5), due soon (today+10), on track (today+120).
const schedules: RawSchedule[] = [
  { id: 'filter', title: 'Replace furnace filter', assetName: 'Furnace (HVAC)', cadenceDays: 90, nextDueOn: '2026-06-30' },
  { id: 'batteries', title: 'Test and replace batteries', assetName: 'Smoke detectors', cadenceDays: 365, nextDueOn: '2026-07-15' },
  { id: 'gutters', title: 'Clean gutters', assetName: 'Gutters', cadenceDays: 180, nextDueOn: '2026-11-02' },
];

describe('maintenance', () => {
  it('classifies overdue, due soon, and on track', () => {
    expect(toMaintenanceView(schedules[0], today).status).toBe('overdue');
    expect(toMaintenanceView(schedules[1], today).status).toBe('due_soon');
    expect(toMaintenanceView(schedules[2], today).status).toBe('ok');
  });

  it('writes human due labels', () => {
    expect(toMaintenanceView(schedules[0], today).dueLabel).toBe('Overdue by 5 days');
    expect(toMaintenanceView(schedules[1], today).dueLabel).toBe('Due in 10 days');
  });

  it('sorts overdue first, then due soon', () => {
    const v = sortSchedules(schedules, today);
    expect(v.map((x) => x.id)).toEqual(['filter', 'batteries', 'gutters']);
  });

  it('reminders are overdue + due soon only', () => {
    const r = dueReminders(schedules, today);
    expect(r.map((x) => x.id)).toEqual(['filter', 'batteries']);
  });
});
