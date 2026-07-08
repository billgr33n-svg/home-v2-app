// Tasks and requests: every task has one owner or says Unassigned
// (PRODUCT_RULES 2), and a visible status (rule 1). Pure domain logic.

export type TaskState =
  | 'not_started'
  | 'accepted'
  | 'in_progress'
  | 'waiting'
  | 'blocked'
  | 'completed'
  | 'verified'
  | 'skipped'
  | 'canceled';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface RawTask {
  id: string;
  title: string;
  state: TaskState;
  ownerId: string | null;
  ownerName: string | null;
  priority: TaskPriority;
  dueAt: string | null;
  recurrenceRule: string | null;
  version: number;
}

export interface TaskView {
  id: string;
  title: string;
  ownerLabel: string;
  unassigned: boolean;
  statusLabel: string;
  priority: TaskPriority;
  recurring: boolean;
  version: number;
}

const OPEN_EXCLUDED: ReadonlySet<TaskState> = new Set<TaskState>(['completed', 'verified', 'canceled', 'skipped']);

export function isOpenTask(state: TaskState): boolean {
  return !OPEN_EXCLUDED.has(state);
}

const STATUS: Record<TaskState, string> = {
  not_started: 'Not started',
  accepted: 'Accepted',
  in_progress: 'In progress',
  waiting: 'Waiting',
  blocked: 'Blocked',
  completed: 'Completed',
  verified: 'Verified',
  skipped: 'Skipped',
  canceled: 'Canceled',
};

export function taskStatusLabel(state: TaskState): string {
  return STATUS[state];
}

const PRANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function toTaskView(t: RawTask): TaskView {
  return {
    id: t.id,
    title: t.title,
    ownerLabel: t.ownerName ?? 'Unassigned',
    unassigned: t.ownerId == null,
    statusLabel: taskStatusLabel(t.state),
    priority: t.priority,
    recurring: Boolean(t.recurrenceRule),
    version: t.version,
  };
}

// Open tasks, Unassigned first (they need an owner), then by priority.
export function openTaskViews(tasks: readonly RawTask[]): TaskView[] {
  return tasks
    .filter((t) => isOpenTask(t.state))
    .map(toTaskView)
    .sort((a, b) => {
      if (a.unassigned !== b.unassigned) return a.unassigned ? -1 : 1;
      return PRANK[a.priority] - PRANK[b.priority];
    });
}
