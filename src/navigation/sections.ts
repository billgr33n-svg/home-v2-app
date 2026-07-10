/**
 * Navigation, as data.
 *
 * Eleven flat tabs needed ~938px of bar; an iPhone gives 390. The old bar
 * scrolled horizontally, which kept every target at 44pt but hid over half the
 * app off-screen behind a gesture nobody discovers. Worse, adding a twelfth
 * destination made the problem strictly worse with no natural place to stop.
 *
 * So destinations are grouped by WHAT THE PERSON IS DOING, not by which table
 * backs the screen:
 *
 *   Today   the one screen you open by reflex
 *   Food    everything between deciding to eat and putting it away
 *   Home    the house and the work it generates
 *   Family  the things people say to each other
 *
 * A fifth "More" slot holds what does not earn a place in the bar. New domains
 * (bills, documents, medical) land in More first and only graduate into a
 * section when they have earned it. That is the point: the bar stops growing.
 *
 * See adr/ADR-0012-navigation-sections.md.
 */

export type ScreenKey =
  | 'today'
  | 'meals'
  | 'shop'
  | 'inventory'
  | 'waste'
  | 'kitchen'
  | 'tasks'
  | 'upkeep'
  | 'events'
  | 'announce'
  | 'polls'
  | 'rides';

export type SectionKey = 'today' | 'food' | 'home' | 'family' | 'more';

export interface Destination {
  key: ScreenKey;
  label: string;
  /** One line, shown in a section's landing list. Say what it is FOR. */
  blurb: string;
}

export interface Section {
  key: SectionKey;
  label: string;
  /** Sections with a single destination render it directly, with no landing list. */
  destinations: Destination[];
}

export const SECTIONS: Section[] = [
  {
    key: 'today',
    label: 'Today',
    destinations: [{ key: 'today', label: 'Today', blurb: 'What needs you now.' }],
  },
  {
    key: 'food',
    label: 'Food',
    destinations: [
      { key: 'meals', label: 'Meals', blurb: 'Tonight, and the week ahead.' },
      { key: 'shop', label: 'Shopping', blurb: 'What to buy, and what ran out.' },
      { key: 'inventory', label: 'Inventory', blurb: 'Fridge, pantry, bar. Scan to count.' },
      { key: 'waste', label: 'Waste', blurb: 'What got eaten, what got thrown away.' },
    ],
  },
  {
    key: 'home',
    label: 'Home',
    destinations: [
      { key: 'kitchen', label: 'Kitchen', blurb: 'Sign up for this week.' },
      { key: 'tasks', label: 'Tasks', blurb: 'Chores and requests.' },
      { key: 'upkeep', label: 'Upkeep', blurb: 'Filters, service, things that need doing.' },
      { key: 'events', label: 'Calendar', blurb: 'What is on, and when.' },
    ],
  },
  {
    key: 'family',
    label: 'Family',
    destinations: [
      { key: 'announce', label: 'News', blurb: 'Announcements everyone should see.' },
      { key: 'polls', label: 'Polls', blurb: 'Ask the house a question.' },
      { key: 'rides', label: 'Rides', blurb: 'Who is driving whom.' },
    ],
  },
  {
    key: 'more',
    label: 'More',
    destinations: [],
  },
];

/** The four that get a slot in the bar. `more` opens a sheet instead. */
export const BAR_SECTIONS = SECTIONS.filter((s) => s.key !== 'more');

export function sectionFor(screen: ScreenKey): Section | undefined {
  return SECTIONS.find((s) => s.destinations.some((d) => d.key === screen));
}

export function destinationFor(screen: ScreenKey): Destination | undefined {
  for (const s of SECTIONS) {
    const d = s.destinations.find((x) => x.key === screen);
    if (d) return d;
  }
  return undefined;
}

/** Where a section lands when you tap it. Single-destination sections skip the list. */
export function landingFor(section: Section): ScreenKey | null {
  return section.destinations.length === 1 ? section.destinations[0].key : null;
}
