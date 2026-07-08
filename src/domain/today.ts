import { type Priority, sortByPriority } from './priority';

// The Today view shows exceptions and decisions, not every record
// (PRODUCT_RULES). This module is pure: the api layer maps database rows into
// TodayInput, and this builds the ordered feed. No I/O, no RN, no Supabase.

export type TodayItemKind =
  | 'ride_unassigned'
  | 'ride'
  | 'dinner_response_needed'
  | 'announcement'
  | 'task_due'
  | 'maintenance';

export interface TodayItem {
  id: string;
  kind: TodayItemKind;
  title: string;
  detail?: string;
  priority: Priority;
  needsDecision: boolean;
}

export interface TodayInput {
  activeMemberCount: number;
  rides: { id: string; driverId: string | null; destination: string; pickup: string | null }[];
  meals: { id: string; title: string; respondedCount: number }[];
  announcements: { id: string; title: string }[];
  tasks: { id: string; title: string; ownerName: string | null }[];
  maintenance: { id: string; title: string }[];
}

export function buildTodayFeed(input: TodayInput): TodayItem[] {
  const items: TodayItem[] = [];

  for (const r of input.rides) {
    const unassigned = r.driverId == null;
    items.push({
      id: `ride-${r.id}`,
      kind: unassigned ? 'ride_unassigned' : 'ride',
      title: unassigned ? `Ride needs a driver: ${r.destination}` : `Ride to ${r.destination}`,
      detail: r.pickup ? `From ${r.pickup}` : undefined,
      priority: unassigned ? 'P0' : 'P2',
      needsDecision: unassigned,
    });
  }

  for (const m of input.meals) {
    const missing = input.activeMemberCount - m.respondedCount;
    if (missing > 0) {
      items.push({
        id: `meal-${m.id}`,
        kind: 'dinner_response_needed',
        title: `Dinner: ${m.title}`,
        detail: `${missing} response${missing === 1 ? '' : 's'} outstanding`,
        priority: 'P1',
        needsDecision: true,
      });
    }
  }

  for (const a of input.announcements) {
    items.push({ id: `ann-${a.id}`, kind: 'announcement', title: a.title, priority: 'P2', needsDecision: false });
  }

  for (const t of input.tasks) {
    items.push({
      id: `task-${t.id}`,
      kind: 'task_due',
      title: t.title,
      detail: t.ownerName ? `Owner: ${t.ownerName}` : 'Unassigned',
      priority: 'P1',
      needsDecision: t.ownerName == null,
    });
  }

  for (const mi of input.maintenance) {
    items.push({ id: `maint-${mi.id}`, kind: 'maintenance', title: mi.title, priority: 'P2', needsDecision: false });
  }

  return sortByPriority(items);
}
