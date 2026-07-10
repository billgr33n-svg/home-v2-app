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
  /** Emoji glyph shown in landing lists and the More sheet. No icon-font dep. */
  icon: string;
}

export interface Section {
  key: SectionKey;
  label: string;
  /** Emoji glyph shown in the tab bar. */
  icon: string;
  /** Sections with a single destination render it directly, with no landing list. */
  destinations: Destination[];
}

export const SECTIONS: Section[] = [
  {
    key: 'today',
    label: 'Today',
    icon: '🌱',
    destinations: [{ key: 'today', label: 'Today', blurb: 'What needs you now.', icon: '🌱' }],
  },
  {
    key: 'food',
    label: 'Food',
    icon: '🍅',
    destinations: [
      { key: 'meals', label: 'Meals', blurb: 'Tonight, and the week ahead.', icon: '🍽️' },
      { key: 'shop', label: 'Shopping', blurb: 'What to buy, and what ran out.', icon: '🧺' },
      { key: 'inventory', label: 'Inventory', blurb: 'Fridge, pantry, bar. Scan to count.', icon: '🥫' },
      { key: 'waste', label: 'Waste', blurb: 'What got eaten, what got thrown away.', icon: '🍂' },
    ],
  },
  {
    key: 'home',
    label: 'Home',
    icon: '🏡',
    destinations: [
      { key: 'kitchen', label: 'Kitchen', blurb: 'Sign up for this week.', icon: '👩‍🍳' },
      { key: 'tasks', label: 'Tasks', blurb: 'Chores and requests.', icon: '🧹' },
      { key: 'upkeep', label: 'Upkeep', blurb: 'Filters, service, things that need doing.', icon: '🔧' },
      { key: 'events', label: 'Calendar', blurb: 'What is on, and when.', icon: '🗓️' },
    ],
  },
  {
    key: 'family',
    label: 'Family',
    icon: '🌻',
    destinations: [
      { key: 'announce', label: 'News', blurb: 'Announcements everyone should see.', icon: '📣' },
      { key: 'polls', label: 'Polls', blurb: 'Ask the house a question.', icon: '🗳️' },
      { key: 'rides', label: 'Rides', blurb: 'Who is driving whom.', icon: '🚗' },
    ],
  },
  {
    key: 'more',
    label: 'More',
    icon: '⋯',
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
