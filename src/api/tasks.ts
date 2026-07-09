import { supabase } from '../lib/supabase';
import { openTaskViews, type RawTask, type TaskView } from '../domain/tasks';

export async function fetchOpenTasks(householdId: string): Promise<TaskView[]> {
  const [tasksRes, profilesRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id,title,state,owner_id,priority,due_at,recurrence_rule,version')
      .eq('household_id', householdId)
      .is('deleted_at', null),
    supabase.from('profiles').select('id,display_name'),
  ]);
  if (tasksRes.error) throw tasksRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const nameById: Record<string, string> = {};
  for (const p of profilesRes.data ?? []) nameById[p.id] = p.display_name;

  const raw: RawTask[] = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    state: t.state,
    ownerId: t.owner_id,
    ownerName: t.owner_id ? nameById[t.owner_id] ?? null : null,
    priority: t.priority,
    dueAt: t.due_at,
    recurrenceRule: t.recurrence_rule,
    version: t.version,
  }));
  return openTaskViews(raw);
}

// Race-safe via the version guard (ADR-0008).
export async function claimTask(taskId: string, version: number): Promise<void> {
  const { error } = await supabase.rpc('claim_task', { p_task_id: taskId, p_expected_version: version });
  if (error) throw error;
}

// Completing a recurring task materializes the next instance server-side.
export async function completeTask(taskId: string, version: number): Promise<void> {
  const { error } = await supabase.rpc('complete_task', { p_task_id: taskId, p_expected_version: version });
  if (error) throw error;
}

export async function addTask(householdId: string, title: string, ownerId: string | null): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('not signed in');
  const { error } = await supabase
    .from('tasks')
    .insert({ household_id: householdId, creator_id: uid, owner_id: ownerId, title });
  if (error) throw error;
}

// Assign a task to any active household member, or clear the owner with null.
// Leaves state alone; the version column bumps automatically.
export async function assignTask(taskId: string, userId: string | null): Promise<void> {
  const { error } = await supabase.from('tasks').update({ owner_id: userId }).eq('id', taskId);
  if (error) throw error;
}
