import React from 'react';
import { Bell, CheckCircle2, Clock, Volume2, VolumeX, X } from 'lucide-react';
import { CourseModule, CourseTask, UserProfile } from '../types/course';
import { formatShortDateTime, TaskAlert } from '../utils/notifications';

interface NotificationDrawerProps {
  isOpen: boolean;
  alerts: TaskAlert[];
  modulesMap: Record<string, CourseModule>;
  profile: UserProfile | null;
  browserPermission: NotificationPermission | 'unsupported';
  onClose: () => void;
  onCompleteTask: (task: CourseTask) => void;
  onSnoozeReminder: (task: CourseTask, minutes: number) => void;
  onDismissReminder: (task: CourseTask) => void;
  onEditTask: (task: CourseTask) => void;
  onRequestBrowserNotifications: () => void;
  onToggleSound: () => void;
  onSendTestNotification: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  alerts,
  modulesMap,
  profile,
  browserPermission,
  onClose,
  onCompleteTask,
  onSnoozeReminder,
  onDismissReminder,
  onEditTask,
  onRequestBrowserNotifications,
  onToggleSound,
  onSendTestNotification,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]">
      <div
        className="w-full max-w-md h-full bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Open Task Reminders"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Reminders &amp; Open Alerts
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              ({alerts.length})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-300">
            Desktop alerts:{' '}
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {browserPermission === 'granted' && profile?.enableBrowserNotifications
                ? 'Active'
                : browserPermission === 'denied'
                ? 'Blocked in browser'
                : browserPermission === 'unsupported'
                ? 'Unavailable'
                : 'Off'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {browserPermission !== 'granted' || !profile?.enableBrowserNotifications ? (
              <button
                type="button"
                onClick={onRequestBrowserNotifications}
                disabled={browserPermission === 'unsupported' || browserPermission === 'denied'}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Enable Desktop Alerts
              </button>
            ) : (
              <button
                type="button"
                onClick={onSendTestNotification}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Test Alert
              </button>
            )}
            <button
              type="button"
              onClick={onToggleSound}
              title={profile?.soundEnabled ? 'Mute reminder chime' : 'Enable reminder chime'}
              aria-label="Toggle reminder sound"
              className="p-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {profile?.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
          {alerts.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                All caught up
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                No overdue items or triggered reminders right now. Set a reminder time on any open task to get notified here and on your desktop.
              </p>
            </div>
          ) : (
            alerts.map((alert) => {
              const mod = modulesMap[alert.task.moduleId];
              const isOverdue = alert.category === 'overdue';
              const isTriggered = alert.category === 'reminder_due';

              return (
                <div key={alert.task.id} className="p-5 space-y-3 hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`font-semibold ${
                            isOverdue
                              ? 'text-red-600 dark:text-red-400'
                              : isTriggered
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isOverdue ? 'Overdue' : isTriggered ? 'Reminder Due' : 'Due Soon'}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          {mod?.code || 'COURSE'}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="capitalize text-slate-600 dark:text-slate-400">
                          {alert.task.kind}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEditTask(alert.task);
                        }}
                        className="text-left text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block"
                      >
                        {alert.task.title}
                      </button>

                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {alert.reason}
                        {alert.task.dueAt ? ` · Due ${formatShortDateTime(alert.task.dueAt)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onCompleteTask(alert.task)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => onSnoozeReminder(alert.task, 60)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Snooze 1h
                    </button>
                    <button
                      type="button"
                      onClick={() => onSnoozeReminder(alert.task, 24 * 60)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Tomorrow
                    </button>
                    {alert.category === 'reminder_due' && (
                      <button
                        type="button"
                        onClick={() => onDismissReminder(alert.task)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors whitespace-nowrap shrink-0"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
