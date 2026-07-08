import { supabase } from '../lib/supabase';
import { tallyPoll, type PollTally } from '../domain/polls';

export interface PollView {
  id: string;
  question: string;
  options: string[];
  closedAt: string | null;
  version: number;
  tally: PollTally;
  myResponse: string | null;
}

export async function fetchPolls(householdId: string): Promise<PollView[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const [pollsRes, membersRes, respRes] = await Promise.all([
    supabase
      .from('polls')
      .select('id,question,options,closed_at,version')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false }),
    supabase
      .from('household_memberships')
      .select('user_id')
      .eq('household_id', householdId)
      .eq('state', 'active'),
    supabase.from('poll_responses').select('poll_id,user_id,response'),
  ]);
  if (pollsRes.error) throw pollsRes.error;
  if (membersRes.error) throw membersRes.error;
  if (respRes.error) throw respRes.error;

  const memberIds = (membersRes.data ?? [])
    .map((m) => m.user_id)
    .filter((x): x is string => Boolean(x));

  const byPoll: Record<string, { userId: string; response: string }[]> = {};
  for (const r of respRes.data ?? []) {
    (byPoll[r.poll_id] ??= []).push({ userId: r.user_id, response: String(r.response ?? '') });
  }

  return (pollsRes.data ?? []).map((p) => {
    const resps = byPoll[p.id] ?? [];
    const options = Array.isArray(p.options) ? (p.options as unknown[]).map(String) : [];
    return {
      id: p.id,
      question: p.question,
      options,
      closedAt: p.closed_at,
      version: p.version,
      tally: tallyPoll({ memberIds, responderIds: resps.map((r) => r.userId) }),
      myResponse: resps.find((r) => r.userId === uid)?.response ?? null,
    };
  });
}

export async function respondToPoll(pollId: string, response: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase
    .from('poll_responses')
    .upsert({ poll_id: pollId, user_id: uid, response }, { onConflict: 'poll_id,user_id' });
  if (error) throw error;
}

export async function closePoll(pollId: string, version: number, decision: string): Promise<void> {
  const { error } = await supabase.rpc('close_poll', {
    p_poll_id: pollId,
    p_expected_version: version,
    p_decision: decision,
  });
  if (error) throw error;
}

export async function createPoll(householdId: string, question: string, options: string[]): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase
    .from('polls')
    .insert({ household_id: householdId, creator_id: uid, question, options });
  if (error) throw error;
}
