import { supabase } from '../lib/supabase';
import { openRideViews, type RawRide, type RideView } from '../domain/rides';

export async function fetchOpenRides(householdId: string): Promise<RideView[]> {
  const [ridesRes, profilesRes] = await Promise.all([
    supabase
      .from('rides')
      .select('id,destination_text,pickup_text,state,driver_id,depart_by,version')
      .eq('household_id', householdId)
      .is('deleted_at', null),
    supabase.from('profiles').select('id,display_name'),
  ]);
  if (ridesRes.error) throw ridesRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const nameById: Record<string, string> = {};
  for (const p of profilesRes.data ?? []) nameById[p.id] = p.display_name;

  const rides: RawRide[] = (ridesRes.data ?? []).map((r) => ({
    id: r.id,
    destination_text: r.destination_text,
    pickup_text: r.pickup_text,
    state: r.state as RawRide['state'],
    driver_id: r.driver_id,
    depart_by: r.depart_by,
    version: r.version,
  }));
  return openRideViews(rides, nameById);
}

export async function claimRide(rideId: string, expectedVersion: number): Promise<void> {
  const { error } = await supabase.rpc('claim_ride', {
    p_ride_id: rideId,
    p_expected_version: expectedVersion,
  });
  if (error) throw error;
}

export async function postRideUpdate(
  rideId: string,
  kind: 'update' | 'escalation',
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc('post_ride_update', {
    p_ride_id: rideId,
    p_kind: kind,
    p_note: note,
  });
  if (error) throw error;
}
