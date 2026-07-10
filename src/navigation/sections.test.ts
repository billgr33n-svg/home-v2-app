import { BAR_SECTIONS, destinationFor, landingFor, SECTIONS, sectionFor, type ScreenKey } from './sections';

const ALL_SCREENS: ScreenKey[] = [
  'today', 'meals', 'shop', 'inventory', 'waste',
  'kitchen', 'tasks', 'upkeep', 'events', 'announce', 'polls', 'rides',
];

describe('sections', () => {
  it('gives every screen exactly one home: a destination in two sections is a bug', () => {
    for (const screen of ALL_SCREENS) {
      const owning = SECTIONS.filter((s) => s.destinations.some((d) => d.key === screen));
      expect(owning).toHaveLength(1);
    }
  });

  it('reaches every screen from some section', () => {
    const reachable = SECTIONS.flatMap((s) => s.destinations.map((d) => d.key));
    expect(new Set(reachable)).toEqual(new Set(ALL_SCREENS));
  });

  it('shows four sections in the bar, which is what fits on a 390px phone', () => {
    expect(BAR_SECTIONS).toHaveLength(4);
    expect(BAR_SECTIONS.map((s) => s.key)).toEqual(['today', 'food', 'home', 'family']);
  });

  it('never lets a section grow past what a landing list can hold', () => {
    for (const s of SECTIONS) expect(s.destinations.length).toBeLessThanOrEqual(5);
  });

  it('sends a single-destination section straight through, with no pointless list', () => {
    const today = SECTIONS.find((s) => s.key === 'today')!;
    expect(landingFor(today)).toBe('today');
  });

  it('makes a multi-destination section show its list', () => {
    const food = SECTIONS.find((s) => s.key === 'food')!;
    expect(landingFor(food)).toBeNull();
  });

  it('resolves a screen back to its section and its label', () => {
    expect(sectionFor('kitchen')?.key).toBe('home');
    expect(sectionFor('inventory')?.key).toBe('food');
    expect(sectionFor('rides')?.key).toBe('family');
    expect(destinationFor('waste')?.label).toBe('Waste');
  });

  it('gives every destination a blurb: a bare list of nouns is not navigation', () => {
    for (const s of SECTIONS) {
      for (const d of s.destinations) {
        expect(d.blurb.length).toBeGreaterThan(0);
        expect(d.blurb.endsWith('.')).toBe(true);
      }
    }
  });
});
