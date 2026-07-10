import type { Session } from '@supabase/supabase-js';

/**
 * A session whose access token has expired is worse than no session at all.
 *
 * When the JWT is stale, supabase-js falls back to sending the anon key, RLS
 * evaluates as `anon`, and PostgREST cheerfully returns `200 []`. Every screen
 * then renders its empty state: Inventory says "Nothing counted yet" over 263
 * real items, Today says "All clear", and the header still shows the household
 * name from the React Query cache. The user concludes their data is gone.
 *
 * So: treat an expired session as no session, and never trust `expires_at`
 * without a skew allowance -- device clocks drift, and a token that expires in
 * four seconds will be dead by the time the request lands.
 */
export const EXPIRY_SKEW_SECONDS = 30;

export function isExpired(session: Session | null, now: Date = new Date()): boolean {
  if (!session) return true;
  // `expires_at` is seconds since epoch. Absent means we cannot prove freshness.
  if (typeof session.expires_at !== 'number') return true;
  const deadline = (session.expires_at - EXPIRY_SKEW_SECONDS) * 1000;
  return now.getTime() >= deadline;
}

/** A session we are willing to make requests with. */
export function isUsable(session: Session | null, now: Date = new Date()): boolean {
  return session !== null && !isExpired(session, now);
}

/** Milliseconds until the token should be refreshed. Never negative. */
export function msUntilRefresh(session: Session | null, now: Date = new Date()): number {
  if (!session || typeof session.expires_at !== 'number') return 0;
  const deadline = (session.expires_at - EXPIRY_SKEW_SECONDS) * 1000;
  return Math.max(0, deadline - now.getTime());
}

/**
 * PostgREST / GoTrue ways of saying "your token is no good".
 * `PGRST301` is JWT expired; 401 is the generic case.
 */
export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; status?: number; message?: string };
  if (e.code === 'PGRST301' || e.code === 'PGRST302') return true;
  if (e.status === 401) return true;
  const msg = (e.message ?? '').toLowerCase();
  return msg.includes('jwt expired') || msg.includes('invalid claim') || msg.includes('token is expired');
}
