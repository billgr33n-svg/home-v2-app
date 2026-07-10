import { supabase } from '../lib/supabase';
import { buildWasteReport, type WasteReport } from '../domain/waste';

// String literal, not concatenation -- see the note in api/lots.ts.
const WASTE_SELECT = 'item_id, delta, reason, inventory_items(name, unit)';

export async function fetchWasteReport(householdId: string, since: Date): Promise<WasteReport> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select(WASTE_SELECT)
    .eq('household_id', householdId)
    .gte('created_at', since.toISOString())
    .in('reason', ['used', 'spoiled', 'scrapped']);

  if (error) throw error;
  return buildWasteReport(data ?? []);
}

/** Local midnight N days back. Calendar days, not 86_400_000 * n. */
export function daysAgo(n: number, now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - n);
  return d;
}
