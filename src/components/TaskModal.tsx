import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
  CourseModule,
  CourseTask,
  ItemKind,
  ItemPriority,
  ItemStatus,
  SCHEMA_LIMITS,
} from '../types/course';
import { fromLocalInputValue, toLocalInputValue } from '../utils/notifications';

interface TaskModalProps {
  isOpen: boolean;
  initialTask: CourseTask | null;
  modules: CourseModule[];
  defaultModuleId: string;
  onClose: () => void;
  onSave: (payload: {
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
  }) => Promise<void>;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  initialTask,
  modules,
  defaultModuleId,
  onClose,
  onSave,
}) => {
  const [moduleId, setModuleId] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ItemKind>('task');
  const [status, setStatus] = useState<ItemStatus>('open');
  const [priority, setPriority] = useState<ItemPriority>('medium');
  const [dueLocal, setDueLocal] = useState('');
  const [reminderLocal, setReminderLocal] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialTask) {
      setModuleId(initialTask.moduleId);
      setTitle(initialTask.title);
      setKind(initialTask.kind);
      setStatus(initialTask.status);
      setPriority(initialTask.priority);
      setDueLocal(toLocalInputValue(initialTask.dueAt));
      setReminderLocal(toLocalInputValue(initialTask.reminderAt));
      setEstimatedMinutes(initialTask.estimatedMinutes);
      setNotes(initialTask.notes);
    } else {
      const fallbackModule = defaultModuleId || modules[0]?.id || '';
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      tomorrow.setHours(18, 0, 0, 0);
      const reminderDefault = new Date(tomorrow.getTime() - 60 * 60 * 1000);

      setModuleId(fallbackModule);
      setTitle('');
      setKind('task');
      setStatus('open');
      setPriority('medium');
      setDueLocal(toLocalInputValue(tomorrow.toISOString()));
      setReminderLocal(toLocalInputValue(reminderDefault.toISOString()));
      setEstimatedMinutes(60);
      setNotes('');
    }
    setError('');
  }, [isOpen, initialTask, modules, defaultModuleId]);

  if (!isOpen) return null;

  const applyReminderOffset = (minutesBeforeDue: number) => {
    if (!dueLocal) {
      const target = new Date(Date.now() + 15 * 60 * 1000);
      setReminderLocal(toLocalInputValue(target.toISOString()));
      return;
    }
    const dueMs = new Date(dueLocal).getTime();
    if (Number.isNaN(dueMs)) return;
    const remDate = new Date(dueMs - minutesBeforeDue * 60 * 1000);
    setReminderLocal(toLocalInputValue(remDate.toISOString()));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId) {
      setError('Please select a course module.');
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Please enter a title for this item.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const nextDueIso = fromLocalInputValue(dueLocal);
      const nextReminderIso = fromLocalInputValue(reminderLocal);
      const reminderChanged = initialTask
        ? nextReminderIso !== initialTask.reminderAt
        : Boolean(nextReminderIso);

      await onSave({
        moduleId,
        title: cleanTitle.slice(0, SCHEMA_LIMITS.TASK_TITLE_MAX),
        kind,
        status,
        priority,
        dueAt: nextDueIso.slice(0, SCHEMA_LIMITS.DATE_ISO_MAX),
        reminderAt: nextReminderIso.slice(0, SCHEMA_LIMITS.DATE_ISO_MAX),
        estimatedMinutes: Math.max(
          0,
          Math.min(SCHEMA_LIMITS.ESTIMATED_MINUTES_MAX, Math.round(Number(estimatedMinutes) || 0))
        ),
        notes: notes.trim().slice(0, SCHEMA_LIMITS.NOTES_MAX),
        reminderDismissed: reminderChanged
          ? false
          : initialTask?.reminderDismissed ?? false,
        completedAt:
          status === 'completed'
            ? initialTask?.completedAt || new Date().toISOString()
            : '',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="task-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {initialTask ? 'Edit Course Item' : 'Add Course Item'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Item Type
              </label>
              <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg gap-1">
                {(['class', 'task', 'assignment'] as ItemKind[]).map((itemKind) => (
                  <button
                    key={itemKind}
                    type="button"
                    onClick={() => setKind(itemKind)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                      kind === itemKind
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {itemKind}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Course Module
              </label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {modules.map((mod) => (
                  <option key={mod.id} value={mod.id}>
                    {mod.code} — {mod.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={SCHEMA_LIMITS.TASK_TITLE_MAX}
              placeholder="e.g., Implement Multi-Head Attention Lab or Attend Lecture 4"
              required
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ItemStatus)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ItemPriority)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Estimated Time (min)
              </label>
              <input
                type="number"
                min={0}
                max={SCHEMA_LIMITS.ESTIMATED_MINUTES_MAX}
                step={5}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Due Date / Class Time
              </label>
              <input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <Bell className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Reminder Notification
                </label>
                {reminderLocal && (
                  <button
                    type="button"
                    onClick={() => setReminderLocal('')}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={reminderLocal}
                onChange={(e) => setReminderLocal(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => applyReminderOffset(60)}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  1h before
                </button>
                <button
                  type="button"
                  onClick={() => applyReminderOffset(24 * 60)}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  1 day before
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const in15m = new Date(Date.now() + 15 * 60 * 1000);
                    setReminderLocal(toLocalInputValue(in15m.toISOString()));
                  }}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  In 15 min
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Syllabus Notes / Links
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={SCHEMA_LIMITS.NOTES_MAX}
              placeholder="Reading links, rubric checkpoints, notebook repo notes..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {saving ? 'Saving...' : initialTask ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
