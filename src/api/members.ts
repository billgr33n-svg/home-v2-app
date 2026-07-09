import { supabase } from '../lib/supabase';

export interface HouseholdMember {
  id: string;
  name: string;
}

// Active members of the household, for owner/cook assignment pickers.
// RLS scopes household_memberships to households you belong to.
export async function fetchHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const [membersRes, profilesRes] = await Promise.all([
    supabase
      .from('household_memberships')
      .select('user_id')
      .eq('household_id', householdId)
      .eq('state', 'active'),
    supabase.from('profiles').select('id,display_name'),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const nameById: Record<string, string> = {};
  for (const p of profilesRes.data ?? []) nameById[p.id] = p.display_name;

  return (membersRes.data ?? [])
    .map((m) => m.user_id)
    .filter((x): x is string => Boolean(x))
    .map((id) => ({ id, name: nameById[id] ?? 'Someone' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
