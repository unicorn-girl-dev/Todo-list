import { CourseTask } from '../types/course';

export type AlertCategory = 'overdue' | 'reminder_due' | 'due_soon';

export interface TaskAlert {
  task: CourseTask;
  category: AlertCategory;
  reason: string;
  sortTime: number;
}

export function isTaskOverdue(task: CourseTask, nowMs: number = Date.now()): boolean {
  if (task.status === 'completed' || !task.dueAt) return false;
  const dueMs = Date.parse(task.dueAt);
  return !Number.isNaN(dueMs) && dueMs < nowMs;
}

export function isReminderTriggered(task: CourseTask, nowMs: number = Date.now()): boolean {
  if (task.status === 'completed' || task.reminderDismissed || !task.reminderAt) return false;
  const remMs = Date.parse(task.reminderAt);
  return !Number.isNaN(remMs) && remMs <= nowMs;
}

export function evaluateTaskAlerts(
  tasks: CourseTask[],
  leadMinutes: number = 1440,
  nowMs: number = Date.now()
): TaskAlert[] {
  const alerts: TaskAlert[] = [];
  const leadMs = Math.max(0, leadMinutes) * 60 * 1000;

  for (const task of tasks) {
    if (task.status === 'completed') continue;

    const dueMs = task.dueAt ? Date.parse(task.dueAt) : Number.NaN;
    const remMs = task.reminderAt ? Date.parse(task.reminderAt) : Number.NaN;

    if (!Number.isNaN(dueMs) && dueMs < nowMs) {
      alerts.push({
        task,
        category: 'overdue',
        reason: `Overdue since ${formatShortDateTime(task.dueAt)}`,
        sortTime: dueMs,
      });
      continue;
    }

    if (!task.reminderDismissed && !Number.isNaN(remMs) && remMs <= nowMs) {
      alerts.push({
        task,
        category: 'reminder_due',
        reason: `Reminder set for ${formatShortDateTime(task.reminderAt)}`,
        sortTime: remMs,
      });
      continue;
    }

    if (!Number.isNaN(dueMs) && dueMs >= nowMs && dueMs - nowMs <= leadMs) {
      alerts.push({
        task,
        category: 'due_soon',
        reason: `Due ${formatRelativeTime(dueMs, nowMs)}`,
        sortTime: dueMs,
      });
    }
  }

  return alerts.sort((a, b) => {
    const rank: Record<AlertCategory, number> = {
      overdue: 0,
      reminder_due: 1,
      due_soon: 2,
    };
    if (rank[a.category] !== rank[b.category]) {
      return rank[a.category] - rank[b.category];
    }
    return a.sortTime - b.sortTime;
  });
}

export function formatShortDateTime(iso: string): string {
  if (!iso) return 'No date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelativeTime(targetMs: number, nowMs: number = Date.now()): string {
  const diffMinutes = Math.round((targetMs - nowMs) / 60000);
  if (diffMinutes < 0) {
    const absMins = Math.abs(diffMinutes);
    if (absMins < 60) return `${absMins}m ago`;
    const hours = Math.round(absMins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }
  if (diffMinutes < 60) return `in ${Math.max(1, diffMinutes)}m`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

export function toLocalInputValue(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInputValue(localVal: string): string {
  if (!localVal) return '';
  const date = new Date(localVal);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

export function playReminderChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Ignore audio context restrictions if user has not interacted yet
  }
}

export function sendDesktopNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag: title,
    });
  } catch {
    // Ignore notification errors inside restricted iframes
  }
}
