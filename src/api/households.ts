import { supabase } from '../lib/supabase';
import type { Household, MemberRole, MembershipWithHousehold } from '../types/models';

// Active memberships for the signed-in user, with their household joined.
export async function fetchMyMemberships(): Promise<MembershipWithHousehold[]> {
  const { data, error } = await supabase
    .from('household_memberships')
    .select('*, households(*)')
    .eq('state', 'active');
  if (error) throw error;
  return (data ?? []) as MembershipWithHousehold[];
}

// Create a household and become its admin (atomic RPC).
export async function createHousehold(name: string, timezone: string): Promise<Household> {
  const { data, error } = await supabase.rpc('create_household', {
    p_name: name,
    p_timezone: timezone,
  });
  if (error) throw error;
  return data as Household;
}

// Join a household by invite token (server-validated RPC).
export async function acceptInvite(token: string): Promise<void> {
  const { error } = await supabase.rpc('accept_invite', { p_token: token });
  if (error) throw error;
}

// Admin-only: create an invite and return its token.
export async function createInvite(
  householdId: string,
  role: MemberRole,
  email?: string,
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('not signed in');
  const { data, error } = await supabase
    .from('household_invites')
    .insert({ household_id: householdId, role, invited_email: email ?? null, created_by: uid })
    .select('token')
    .single();
  if (error) throw error;
  return data.token;
}

// Leave a household (membership goes to the `left` state; history is preserved).
export async function leaveHousehold(membershipId: string): Promise<void> {
  const { error } = await supabase
    .from('household_memberships')
    .update({ state: 'left' })
    .eq('id', membershipId);
  if (error) throw error;
}
