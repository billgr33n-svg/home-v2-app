// Notification priority for the Phase 1 essentials only: rides, dinner,
// announcements, departures (spec section 3). P0 is most urgent, P2 least.
// Pure domain logic, unit-tested. No I/O, no RN, no Supabase.

export type NotificationKind =
  | 'ride_escalation' // last-mile ride problem, someone must act now
  | 'departure_reminder'
  | 'dinner_response_needed'
  | 'ride_update'
  | 'announcement';

export type Priority = 'P0' | 'P1' | 'P2';

const PRIORITY_BY_KIND: Record<NotificationKind, Priority> = {
  ride_escalation: 'P0',
  departure_reminder: 'P1',
  dinner_response_needed: 'P1',
  ride_update: 'P2',
  announcement: 'P2',
};

const RANK: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 };

export function priorityForKind(kind: NotificationKind): Priority {
  return PRIORITY_BY_KIND[kind];
}

// Negative if a is more urgent than b. Suitable for Array.prototype.sort.
export function comparePriority(a: Priority, b: Priority): number {
  return RANK[a] - RANK[b];
}

// Most-urgent first. Stable relative to the input order within a priority.
export function sortByPriority<T extends { priority: Priority }>(
  items: readonly T[],
): T[] {
  return [...items].sort((x, y) => comparePriority(x.priority, y.priority));
}
