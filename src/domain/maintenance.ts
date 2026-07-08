// Recurring maintenance: a home asset with a cadence produces due reminders
// (PRODUCT_RULES 1, visible status). Pure domain logic. Dates are ISO YYYY-MM-DD.

export type MaintenanceStatus = 'overdue' | 'due_soon' | 'ok';

export interface RawSchedule {
  id: string;
  title: string;
  assetName: string;
  cadenceDays: number;
  nextDueOn: string;
}

export interface MaintenanceView {
  id: string;
  title: string;
  assetName: string;
  status: MaintenanceStatus;
  statusLabel: string;
  dueLabel: string;
  dueInDays: number;
}

const DUE_SOON_WINDOW = 14;

export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function toMaintenanceView(s: RawSchedule, today: string = todayISO()): MaintenanceView {
  const dueInDays = daysBetween(today, s.nextDueOn);
  const status: MaintenanceStatus = dueInDays < 0 ? 'overdue' : dueInDays <= DUE_SOON_WINDOW ? 'due_soon' : 'ok';
  const statusLabel = status === 'overdue' ? 'Overdue' : status === 'due_soon' ? 'Due soon' : 'On track';
  const absDays = Math.abs(dueInDays);
  const dueLabel =
    dueInDays < 0
      ? `Overdue by ${absDays} day${absDays === 1 ? '' : 's'}`
      : dueInDays === 0
        ? 'Due today'
        : `Due in ${dueInDays} day${dueInDays === 1 ? '' : 's'}`;
  return { id: s.id, title: s.title, assetName: s.assetName, status, statusLabel, dueLabel, dueInDays };
}

const RANK: Record<MaintenanceStatus, number> = { overdue: 0, due_soon: 1, ok: 2 };

// Most-pressing first: overdue, then due soon, then on track; earliest due first.
export function sortSchedules(items: readonly RawSchedule[], today: string = todayISO()): MaintenanceView[] {
  return items
    .map((s) => toMaintenanceView(s, today))
    .sort((a, b) => (RANK[a.status] !== RANK[b.status] ? RANK[a.status] - RANK[b.status] : a.dueInDays - b.dueInDays));
}

// The reminder set the household should act on: overdue + due soon.
export function dueReminders(items: readonly RawSchedule[], today: string = todayISO()): MaintenanceView[] {
  return sortSchedules(items, today).filter((v) => v.status !== 'ok');
}
