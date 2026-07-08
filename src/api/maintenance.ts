import { supabase } from '../lib/supabase';
import { sortSchedules, type MaintenanceView, type RawSchedule } from '../domain/maintenance';

export async function fetchMaintenance(householdId: string): Promise<MaintenanceView[]> {
  const [schedRes, assetsRes] = await Promise.all([
    supabase
      .from('maintenance_schedules')
      .select('id,title,cadence_days,next_due_on,asset_id')
      .eq('household_id', householdId)
      .is('deleted_at', null),
    supabase.from('home_assets').select('id,name').eq('household_id', householdId).is('deleted_at', null),
  ]);
  if (schedRes.error) throw schedRes.error;
  if (assetsRes.error) throw assetsRes.error;

  const nameById: Record<string, string> = {};
  for (const a of assetsRes.data ?? []) nameById[a.id] = a.name;

  const raw: RawSchedule[] = (schedRes.data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    cadenceDays: r.cadence_days,
    nextDueOn: r.next_due_on,
    assetName: nameById[r.asset_id] ?? 'Asset',
  }));
  return sortSchedules(raw);
}

// Stamps today and advances next_due_on by the cadence (server-side).
export async function completeMaintenance(scheduleId: string): Promise<void> {
  const { error } = await supabase.rpc('complete_maintenance', { p_schedule_id: scheduleId });
  if (error) throw error;
}
