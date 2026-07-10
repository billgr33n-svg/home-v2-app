import {
  addDays, buildWeek, imminentOpen, isCovered, openCount, shiftStatus,
  toIsoDate, weekLabel, weekLoad, weekStart, whoLabel, type RawShift,
} from './kitchen';

const BILL = 'u-bill';
const SANDY = 'u-sandy';

function shift(p: Partial<RawShift>): RawShift {
  return {
    id: 'x', shiftDate: '2026-07-06', role: 'am_unload', detail: null,
    claimedById: null, claimedByName: null,
    originalClaimedById: null, originalClaimedByName: null,
    completedAt: null, skippedAt: null, version: 1, ...p,
  };
}

describe('weekStart', () => {
  it('returns the same day for a Monday', () => {
    expect(toIsoDate(weekStart(new Date(2026, 6, 6, 9, 0)))).toBe('2026-07-06');
  });

  it('walks back to Monday from mid-week', () => {
    expect(toIsoDate(weekStart(new Date(2026, 6, 9, 23, 30)))).toBe('2026-07-06');
  });

  it('sends SUNDAY back six days, not forward one', () => {
    // getDay() is 0 for Sunday. The naive `day - 1` sends it to the wrong week.
    expect(toIsoDate(weekStart(new Date(2026, 6, 12, 18, 0)))).toBe('2026-07-06');
  });

  it('ignores the time of day', () => {
    expect(toIsoDate(weekStart(new Date(2026, 6, 8, 0, 1)))).toBe('2026-07-06');
    expect(toIsoDate(weekStart(new Date(2026, 6, 8, 23, 59)))).toBe('2026-07-06');
  });

  it('crosses a month boundary', () => {
    expect(toIsoDate(weekStart(new Date(2026, 7, 1, 12, 0)))).toBe('2026-07-27');
  });
});

describe('addDays', () => {
  it('spans a spring-forward week without losing a day', () => {
    // US DST begins 8 March 2026. The week is 167 hours, still 7 calendar days.
    const monday = new Date(2026, 2, 2);
    expect(toIsoDate(addDays(monday, 6))).toBe('2026-03-08');
  });

  it('spans a fall-back week without gaining one', () => {
    const monday = new Date(2026, 9, 26); // DST ends 1 Nov 2026
    expect(toIsoDate(addDays(monday, 6))).toBe('2026-11-01');
  });
});

describe('shiftStatus', () => {
  it('is open when nobody has claimed it', () => {
    expect(shiftStatus(shift({}))).toBe('open');
  });
  it('is claimed once someone signs up', () => {
    expect(shiftStatus(shift({ claimedById: BILL }))).toBe('claimed');
  });
  it('lets done beat skipped', () => {
    expect(shiftStatus(shift({ claimedById: BILL, completedAt: 'x', skippedAt: 'y' }))).toBe('done');
  });
});

describe('isCovered / whoLabel', () => {
  it('is not coverage when the original claimant still holds it', () => {
    const s = shift({ claimedById: BILL, originalClaimedById: BILL, claimedByName: 'Bill' });
    expect(isCovered(s)).toBe(false);
    expect(whoLabel(s)).toBe('Bill');
  });

  it('is coverage when someone else took it over, and says who for', () => {
    const s = shift({
      claimedById: SANDY, claimedByName: 'Sandy',
      originalClaimedById: BILL, originalClaimedByName: 'Bill',
    });
    expect(isCovered(s)).toBe(true);
    expect(whoLabel(s)).toBe('Sandy (covering for Bill)');
  });

  it('is never coverage on an open slot, even one that was released', () => {
    const s = shift({ claimedById: null, originalClaimedById: BILL });
    expect(isCovered(s)).toBe(false);
    expect(whoLabel(s)).toBe('Open');
  });
});

describe('buildWeek', () => {
  const monday = new Date(2026, 6, 6);
  const now = new Date(2026, 6, 8, 10, 0); // Wednesday

  it('lays out seven days starting Monday', () => {
    const days = buildWeek([], monday, now, BILL);
    expect(days.map((d) => d.weekdayShort)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(days[0].date).toBe('2026-07-06');
    expect(days[6].date).toBe('2026-07-12');
  });

  it('marks today and the past', () => {
    const days = buildWeek([], monday, now, BILL);
    expect(days.find((d) => d.isToday)?.date).toBe('2026-07-08');
    expect(days.filter((d) => d.isPast).map((d) => d.weekdayShort)).toEqual(['Mon', 'Tue']);
  });

  it('orders shifts the way the day runs, with fridge duty last', () => {
    const rows: RawShift[] = [
      shift({ id: 'f', shiftDate: '2026-07-08', role: 'fridge', detail: 'Kitchen' }),
      shift({ id: 'w', shiftDate: '2026-07-08', role: 'pm_wipe' }),
      shift({ id: 'u', shiftDate: '2026-07-08', role: 'am_unload' }),
      shift({ id: 'l', shiftDate: '2026-07-08', role: 'pm_lead' }),
      shift({ id: 'h', shiftDate: '2026-07-08', role: 'pm_helper' }),
    ];
    const wed = buildWeek(rows, monday, now, BILL)[2];
    expect(wed.shifts.map((s) => s.id)).toEqual(['u', 'l', 'h', 'w', 'f']);
  });

  it('labels a fridge duty by its location, not the bare role', () => {
    const rows = [shift({ shiftDate: '2026-07-08', role: 'fridge', detail: 'Garage' })];
    expect(buildWeek(rows, monday, now, BILL)[2].shifts[0].label).toBe('Garage fridge');
  });

  it('knows which slots are mine', () => {
    const rows = [
      shift({ id: 'a', shiftDate: '2026-07-06', claimedById: BILL }),
      shift({ id: 'b', shiftDate: '2026-07-06', role: 'pm_lead', claimedById: SANDY }),
    ];
    const mon = buildWeek(rows, monday, now, BILL)[0];
    expect(mon.shifts.map((s) => s.mine)).toEqual([true, false]);
  });

  it('counts open slots per day and across the week', () => {
    const rows = [
      shift({ id: 'a', shiftDate: '2026-07-06' }),
      shift({ id: 'b', shiftDate: '2026-07-06', role: 'pm_lead', claimedById: BILL }),
      shift({ id: 'c', shiftDate: '2026-07-07' }),
    ];
    const days = buildWeek(rows, monday, now, BILL);
    expect(days[0].openCount).toBe(1);
    expect(openCount(days)).toBe(2);
  });

  it('does not count a done or skipped slot as open', () => {
    const rows = [
      shift({ id: 'a', shiftDate: '2026-07-06', claimedById: BILL, completedAt: 'x' }),
      shift({ id: 'b', shiftDate: '2026-07-06', role: 'pm_lead', skippedAt: 'x' }),
    ];
    expect(openCount(buildWeek(rows, monday, now, BILL))).toBe(0);
  });
});

describe('imminentOpen', () => {
  const monday = new Date(2026, 6, 6);
  const now = new Date(2026, 6, 8, 20, 0); // Wednesday evening

  it('nags about today and tomorrow only', () => {
    const rows = [
      shift({ id: 'mon', shiftDate: '2026-07-06' }),
      shift({ id: 'wed', shiftDate: '2026-07-08' }),
      shift({ id: 'thu', shiftDate: '2026-07-09' }),
      shift({ id: 'fri', shiftDate: '2026-07-10' }),
    ];
    const days = buildWeek(rows, monday, now, BILL);
    expect(imminentOpen(days, now).map((s) => s.id)).toEqual(['wed', 'thu']);
  });

  it('says nothing when the board is filled', () => {
    const rows = [shift({ id: 'wed', shiftDate: '2026-07-08', claimedById: BILL })];
    const days = buildWeek(rows, monday, now, BILL);
    expect(imminentOpen(days, now)).toEqual([]);
  });
});

describe('weekLoad', () => {
  const monday = new Date(2026, 6, 6);
  const now = new Date(2026, 6, 8);

  it('ranks who is carrying the week, and separates done from merely claimed', () => {
    const rows = [
      shift({ id: '1', shiftDate: '2026-07-06', claimedById: BILL, claimedByName: 'Bill', originalClaimedById: BILL, completedAt: 'x' }),
      shift({ id: '2', shiftDate: '2026-07-06', role: 'pm_lead', claimedById: BILL, claimedByName: 'Bill', originalClaimedById: BILL }),
      shift({ id: '3', shiftDate: '2026-07-07', claimedById: SANDY, claimedByName: 'Sandy', originalClaimedById: SANDY }),
    ];
    const load = weekLoad(buildWeek(rows, monday, now, BILL));
    expect(load[0]).toMatchObject({ name: 'Bill', claimed: 2, completed: 1, covering: 0 });
    expect(load[1]).toMatchObject({ name: 'Sandy', claimed: 1, completed: 0 });
  });

  it('counts how many of your slots are you covering for someone else', () => {
    const rows = [
      shift({ id: '1', shiftDate: '2026-07-06', claimedById: SANDY, claimedByName: 'Sandy', originalClaimedById: BILL, originalClaimedByName: 'Bill' }),
    ];
    expect(weekLoad(buildWeek(rows, monday, now, BILL))[0]).toMatchObject({ name: 'Sandy', covering: 1 });
  });

  it('ignores unclaimed slots entirely', () => {
    expect(weekLoad(buildWeek([shift({})], monday, now, BILL))).toEqual([]);
  });
});

describe('weekLabel', () => {
  it('spans the week, including across a month boundary', () => {
    expect(weekLabel(new Date(2026, 6, 6))).toBe('Jul 6 – Jul 12');
    expect(weekLabel(new Date(2026, 6, 27))).toBe('Jul 27 – Aug 2');
  });
});
