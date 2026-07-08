// Dinner responses: the family answers in or out in one or two taps, and the
// cook sees who is still outstanding and how many plates to prepare
// (PRODUCT_RULES: family-wide asks show who has and has not responded).
// Pure domain logic. No I/O, no RN, no Supabase.

export type MealResponse = 'home' | 'later' | 'away' | 'save_plate' | 'guest' | 'unsure';

export interface DinnerMemberResponse {
  userId: string;
  response: MealResponse;
  guestCount?: number;
}

export interface DinnerSummary {
  total: number;
  respondedCount: number;
  outstandingIds: string[];
  homeCount: number; // members eating with the household (home, save_plate, guest)
  awayCount: number;
  headcount: number; // plates to prepare: attendees plus their guests
  complete: boolean;
}

const ATTENDING: ReadonlySet<MealResponse> = new Set<MealResponse>(['home', 'save_plate', 'guest']);

export function summarizeDinner(
  memberIds: readonly string[],
  responses: readonly DinnerMemberResponse[],
): DinnerSummary {
  const members = new Set(memberIds);
  const byUser = new Map<string, DinnerMemberResponse>();
  for (const r of responses) {
    // Count only responses from current members; last write wins.
    if (members.has(r.userId)) byUser.set(r.userId, r);
  }

  const outstandingIds = memberIds.filter((id) => !byUser.has(id));
  let homeCount = 0;
  let awayCount = 0;
  let headcount = 0;
  for (const r of byUser.values()) {
    if (ATTENDING.has(r.response)) {
      homeCount += 1;
      headcount += 1 + Math.max(0, r.guestCount ?? 0);
    } else if (r.response === 'away') {
      awayCount += 1;
    }
    // 'later' and 'unsure' count as responded but commit to nothing.
  }

  return {
    total: memberIds.length,
    respondedCount: memberIds.length - outstandingIds.length,
    outstandingIds,
    homeCount,
    awayCount,
    headcount,
    complete: outstandingIds.length === 0,
  };
}

export function dinnerResponseLabel(r: MealResponse): string {
  switch (r) {
    case 'home':
      return 'Home';
    case 'away':
      return 'Away';
    case 'save_plate':
      return 'Save a plate';
    case 'later':
      return 'Decide later';
    case 'guest':
      return 'Bringing a guest';
    case 'unsure':
      return 'Not sure';
  }
}

// One-line summary for the meal card.
export function dinnerSummaryLabel(s: DinnerSummary): string {
  if (s.complete) return `All answered · ${s.headcount} for dinner`;
  const missing = s.total - s.respondedCount;
  return `${missing} to answer · ${s.homeCount} in, ${s.awayCount} out`;
}
