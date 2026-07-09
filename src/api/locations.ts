import { supabase } from '../lib/supabase';

export interface StorageLocation {
  id: string;
  name: string;
}

export async function fetchLocations(householdId: string): Promise<StorageLocation[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id,name,sort_order')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
}

// Locations belong to a property. A household has at least one; we attach new
// locations to the first. (Multi-property households get a picker later.)
export async function createLocation(householdId: string, name: string): Promise<StorageLocation> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give the location a name.');

  const { data: props, error: propErr } = await supabase
    .from('properties')
    .select('id')
    .eq('household_id', householdId)
    .limit(1);
  if (propErr) throw propErr;
  const propertyId = props?.[0]?.id;
  if (!propertyId) throw new Error('No property set up for this household yet.');

  const { data: last } = await supabase
    .from('locations')
    .select('sort_order')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = (last?.[0]?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('locations')
    .insert({
      household_id: householdId,
      property_id: propertyId,
      name: trimmed,
      location_type: 'storage',
      sort_order: nextOrder,
    })
    .select('id,name')
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name };
}
