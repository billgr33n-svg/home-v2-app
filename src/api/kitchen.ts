import { supabase } from '../lib/supabase';
import { toIsoDate, type KitchenRole, type RawShift } from '../domain/kitchen';

/**
 * One string literal on one line. Concatenating it with `+` widens the type to
 * `string`, and supabase-js can only infer a row type from a literal -- the
 * result silently degrades to `SelectQueryError`. That has bitten this codebase
 * twice (fetchInventory, and again in 0019's types).
 *
 * `kitchen_shifts` points at `profiles` twice, so each embed needs an explicit
 * FK hint; without it PostgREST cannot tell which relationship you mean.
 */
const SHIFT_SELECT = 'id, shift_date, role, detail, claimed_by, original_claimed_by, completed_at, skipped_at, version, holder:profiles!kitchen_shifts_claimed_by_fkey(display_name), origin:profiles!kitchen_shifts_original_claimed_by_fkey(display_name)';

interface ShiftRow {
  id: string;
  shift_date: string;
  role: KitchenRole;
  detail: string | null;
  claimed_by: string | null;
  original_claimed_by: string | null;
  completed_at: string | null;
  skipped_at: string | null;
  version: number;
  holder: { display_name: string } | null;
  origin: { display_name: string } | null;
}

function toRaw(r: ShiftRow): RawShift {
  return {
    id: r.id,
    shiftDate: r.shift_date,
    role: r.role,
    detail: r.detail,
    claimedById: r.claimed_by,
    claimedByName: r.holder?.display_name ?? null,
    originalClaimedById: r.original_claimed_by,
    originalClaimedByName: r.origin?.display_name ?? null,
    completedAt: r.completed_at,
    skippedAt: r.skipped_at,
    version: r.version,
  };
}

/**
 * Materialise the board, then read it.
 *
 * `ensure_kitchen_week` is idempotent (a unique index does the work), so calling
 * it on every week navigation is safe and means a brand-new week is never blank
 * because someone forgot to seed it.
 */
export async function fetchKitchenWeek(householdId: string, weekStartDate: Date): Promise<RawShift[]> {
  const week = toIsoDate(weekStartDate);

  const { error: ensureErr } = await supabase.rpc('ensure_kitchen_week', {
    p_household: householdId,
    p_week_start: week,
  });
  if (ensureErr) throw ensureErr;

  const { data, error } = await supabase
    .from('kitchen_shifts')
    .select(SHIFT_SELECT)
    .eq('household_id', householdId)
    .eq('week_start', week)
    .is('deleted_at', null);

  if (error) throw error;
  return (data as unknown as ShiftRow[]).map(toRaw);
}

/**
 * Every mutation carries the version it saw.
 *
 * Two people tapping "I'll do it" on the same slot in the same second is the
 * normal case for a signup board, not an edge case (ADR-0008). The loser gets an
 * error rather than silently overwriting the winner.
 */
export async function claimShift(shiftId: string, expectedVersion: number): Promise<void> {
  const { error } = await supabase.rpc('claim_shift', { p_shift: shiftId, p_expected_version: expectedVersion });
  if (error) throw error;
}

export async function releaseShift(shiftId: string, expectedVersion: number): Promise<void> {
  const { error } = await supabase.rpc('release_shift', { p_shift: shiftId, p_expected_version: expectedVersion });
  if (error) throw error;
}

export async function coverShift(shiftId: string, userId: string, expectedVersion: number): Promise<void> {
  const { error } = await supabase.rpc('cover_shift', {
    p_shift: shiftId,
    p_user: userId,
    p_expected_version: expectedVersion,
  });
  if (error) throw error;
}

export async function completeShift(shiftId: string, expectedVersion: number): Promise<void> {
  const { error } = await supabase.rpc('complete_shift', { p_shift: shiftId, p_expected_version: expectedVersion });
  if (error) throw error;
}

/**
 * Copy last week's names forward into the empty slots of this one.
 *
 * The escape hatch for open signup: an empty board on Sunday night means nobody
 * unloads on Monday. Never overwrites a real claim; only fills the blanks.
 */
export async function copyKitchenWeek(householdId: string, from: Date, to: Date): Promise<number> {
  const { data, error } = await supabase.rpc('copy_kitchen_week', {
    p_household: householdId,
    p_from: toIsoDate(from),
    p_to: toIsoDate(to),
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Human text for the errors these RPCs raise. They are all lost-race variants. */
export function shiftError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '');
  const s = raw.toLowerCase();
  if (s.includes('already claimed') || s.includes('unavailable')) return 'Someone just took that slot.';
  if (s.includes('not yours to release')) return "That's not yours to give up.";
  if (s.includes('not an active member')) return 'That person is not in this household.';
  if (s.includes('changed under you')) return 'That slot changed while you were looking. Pull to refresh.';
  if (s.includes('nothing to complete')) return 'Nothing to mark done there.';
  return 'That did not save. Try again.';
}
