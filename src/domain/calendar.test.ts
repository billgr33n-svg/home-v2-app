import type { EventView } from '../api/events';
import {
  addDays,
  dateKey,
  eventDayKey,
  groupByDay,
  monthGridDays,
  startOfMonth,
  startOfWeek,
  timeRangeLabel,
} from './calendar';

function ev(partial: Partial<EventView>): EventView {
  return {
    id: 'x',
    title: 't',
    startsAt: '2026-07-10T18:00:00',
    endsAt: null,
    location: null,
    description: null,
    allDay: false,
    ...partial,
  };
}

describe('calendar date math', () => {
  it('keys a late-evening event to its LOCAL day, not the UTC one', () => {
    // 10pm local on the 10th is 2am UTC on the 11th for US-eastern; the family
    // must see it on the 10th.
    const local = new Date(2026, 6, 10, 22, 0, 0);
    expect(eventDayKey(ev({ startsAt: local.toISOString() }))).toBe('2026-07-10');
  });

  it('starts the week on Sunday from any weekday', () => {
    // 2026-07-10 is a Friday; its week starts Sunday 2026-07-05.
    expect(dateKey(startOfWeek(new Date(2026, 6, 10)))).toBe('2026-07-05');
    expect(dateKey(startOfWeek(new Date(2026, 6, 5)))).toBe('2026-07-05');
  });

  it('survives a DST boundary: adding days never lands mid-hour', () => {
    // US spring-forward 2026-03-08. Naive +24h math yields 23:00 the prior day.
    const before = new Date(2026, 2, 7);
    const after = addDays(before, 2);
    expect(dateKey(after)).toBe('2026-03-09');
    expect(after.getHours()).toBe(0);
  });

  it('always renders a 42-cell month grid, starting on a Sunday', () => {
    const days = monthGridDays(startOfMonth(new Date(2026, 6, 15)));
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(0);
    expect(dateKey(days[0])).toBe('2026-06-28'); // July 2026 starts Wednesday
    expect(days.some((d) => dateKey(d) === '2026-07-31')).toBe(true);
  });

  it('groups by day with all-day events first, then by time', () => {
    const a = ev({ id: 'a', startsAt: new Date(2026, 6, 10, 18).toISOString() });
    const b = ev({ id: 'b', startsAt: new Date(2026, 6, 10, 9).toISOString() });
    const c = ev({ id: 'c', startsAt: '2026-07-10', allDay: true });
    const by = groupByDay([a, b, c]);
    expect(by.get('2026-07-10')?.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('labels time ranges, and all-day as All day', () => {
    const start = new Date(2026, 6, 10, 18, 0);
    const end = new Date(2026, 6, 10, 19, 30);
    expect(timeRangeLabel(ev({ startsAt: start.toISOString(), endsAt: end.toISOString() }))).toBe(
      '6:00 PM – 7:30 PM',
    );
    expect(timeRangeLabel(ev({ startsAt: '2026-07-10', allDay: true }))).toBe('All day');
  });
});
