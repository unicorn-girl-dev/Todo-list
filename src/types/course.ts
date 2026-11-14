export type ItemKind = 'class' | 'task' | 'assignment';
export type ItemStatus = 'open' | 'in_progress' | 'completed';
export type ItemPriority = 'low' | 'medium' | 'high';

export const SCHEMA_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  ID_MAX: 128,
  DISPLAY_NAME_MAX: 100,
  EMAIL_MAX: 200,
  MODULE_CODE_MAX: 24,
  MODULE_TITLE_MAX: 120,
  INSTRUCTOR_MAX: 100,
  TASK_TITLE_MAX: 160,
  DATE_ISO_MAX: 40,
  NOTES_MAX: 2000,
  ESTIMATED_MINUTES_MAX: 1440,
  LEAD_MINUTES_MAX: 10080,
} as const;

export interface UserProfile {
  id: string;
  ownerId: string;
  displayName: string;
  email: string;
  enableBrowserNotifications: boolean;
  defaultLeadMinutes: number;
  soundEnabled: boolean;
}

export interface CourseModule {
  id: string;
  ownerId: string;
  code: string;
  title: string;
  instructor: string;
  orderIndex: number;
}

export interface CourseTask {
  id: string;
  ownerId: string;
  moduleId: string;
  title: string;
  kind: ItemKind;
  status: ItemStatus;
  priority: ItemPriority;
  dueAt: string;
  reminderAt: string;
  estimatedMinutes: number;
  notes: string;
  reminderDismissed: boolean;
  completedAt: string;
}

export type WorkspaceView = 'overview' | 'items' | 'modules' | 'reminders';

export type StatusFilter = 'all' | 'open' | 'in_progress' | 'completed' | 'overdue';
export type KindFilter = 'all' | ItemKind;
export type SortOption = 'due_asc' | 'priority_desc' | 'title_asc';

export function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function generateFirestoreId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now()}_${random}`;
}
