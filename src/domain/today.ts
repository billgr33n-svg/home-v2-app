import { type Priority, sortByPriority } from './priority';

// Re-exported so screens can type their priority maps without reaching past today.
export type { Priority };

// The Today view shows exceptions and decisions, not every record
// (PRODUCT_RULES). This module is pure: the api layer maps database rows into
// TodayInput, and this builds the ordered feed. No I/O, no RN, no Supabase.
//
// Each item carries `entityId` (the underlying row id) so Today can act on it
// directly — assign an owner, complete it, resolve it — without re-querying.

export type TodayItemKind =
  | 'ride_unassigned'
  | 'ride'
  | 'dinner_response_needed'
  | 'poll_response_needed'
  | 'announcement'
  | 'task_due'
  | 'maintenance';

export interface TodayItem {
  id: string;
  entityId: string;
  kind: TodayItemKind;
  title: string;
  detail?: string;
  priority: Priority;
  needsDecision: boolean;
  version?: number;
  ownerId?: string | null;
  /** Poll options, carried so Today can record a vote in place. */
  options?: string[];
}

export interface TodayInput {
  activeMemberCount: number;
  rides: { id: string; driverId: string | null; destination: string; pickup: string | null; version?: number }[];
  meals: { id: string; title: string; respondedCount: number }[];
  polls: { id: string; question: string; outstandingCount: number; options: string[] }[];
  announcements: { id: string; title: string }[];
  tasks: { id: string; title: string; ownerName: string | null; ownerId?: string | null; version?: number }[];
  maintenance: { id: string; title: string }[];
}

export function buildTodayFeed(input: TodayInput): TodayItem[] {
  const items: TodayItem[] = [];

  for (const r of input.rides) {
    const unassigned = r.driverId == null;
    items.push({
      id: `ride-${r.id}`,
      entityId: r.id,
      kind: unassigned ? 'ride_unassigned' : 'ride',
      title: unassigned ? `Ride needs a driver: ${r.destination}` : `Ride to ${r.destination}`,
      detail: r.pickup ? `From ${r.pickup}` : undefined,
      priority: unassigned ? 'P0' : 'P2',
      needsDecision: unassigned,
      version: r.version,
      ownerId: r.driverId,
    });
  }

  for (const m of input.meals) {
    const missing = input.activeMemberCount - m.respondedCount;
    if (missing > 0) {
      items.push({
        id: `meal-${m.id}`,
        entityId: m.id,
        kind: 'dinner_response_needed',
        title: `Dinner: ${m.title}`,
        detail: `${missing} response${missing === 1 ? '' : 's'} outstanding`,
        priority: 'P1',
        needsDecision: true,
      });
    }
  }

  // An open poll with anyone still to vote is a decision the house owes an
  // answer to. It rides lower than a missed dinner (P2), but it belongs on
  // Today rather than only in the Polls tab, where nobody looks by reflex.
  for (const p of input.polls) {
    if (p.outstandingCount > 0) {
      items.push({
        id: `poll-${p.id}`,
        entityId: p.id,
        kind: 'poll_response_needed',
        title: `Poll: ${p.question}`,
        detail: `${p.outstandingCount} still to answer`,
        priority: 'P2',
        needsDecision: true,
        options: p.options,
      });
    }
  }

  for (const a of input.announcements) {
    items.push({
      id: `ann-${a.id}`,
      entityId: a.id,
      kind: 'announcement',
      title: a.title,
      priority: 'P2',
      needsDecision: false,
    });
  }

  for (const t of input.tasks) {
    items.push({
      id: `task-${t.id}`,
      entityId: t.id,
      kind: 'task_due',
      title: t.title,
      detail: t.ownerName ? `Owner: ${t.ownerName}` : 'Unassigned',
      priority: 'P1',
      needsDecision: t.ownerName == null,
      version: t.version,
      ownerId: t.ownerId ?? null,
    });
  }

  for (const mi of input.maintenance) {
    items.push({
      id: `maint-${mi.id}`,
      entityId: mi.id,
      kind: 'maintenance',
      title: mi.title,
      priority: 'P2',
      needsDecision: false,
    });
  }

  return sortByPriority(items);
}
