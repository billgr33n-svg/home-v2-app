// Family-wide requests show who has and has not responded (PRODUCT_RULES).

export interface PollTallyInput {
  memberIds: string[];
  responderIds: string[];
}

export interface PollTally {
  total: number;
  respondedCount: number;
  notRespondedIds: string[];
  complete: boolean;
}

export function tallyPoll(input: PollTallyInput): PollTally {
  const responded = new Set(input.responderIds);
  const notRespondedIds = input.memberIds.filter((id) => !responded.has(id));
  return {
    total: input.memberIds.length,
    respondedCount: input.memberIds.length - notRespondedIds.length,
    notRespondedIds,
    complete: notRespondedIds.length === 0,
  };
}

export function tallyLabel(t: PollTally): string {
  return t.complete ? 'All responded' : `${t.respondedCount} of ${t.total} responded`;
}
