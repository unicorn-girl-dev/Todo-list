import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  FolderPlus,
  Layers,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  CourseModule,
  CourseTask,
  ItemKind,
  ItemPriority,
  ItemStatus,
  KindFilter,
  SortOption,
  StatusFilter,
  UserProfile,
  WorkspaceView,
} from '../types/course';
import {
  evaluateTaskAlerts,
  formatShortDateTime,
  isTaskOverdue,
  TaskAlert,
} from '../utils/notifications';

interface DashboardWorkspaceProps {
  userEmail: string;
  userName: string;
  profile: UserProfile | null;
  modules: CourseModule[];
  tasks: CourseTask[];
  loading: boolean;
  darkMode: boolean;
  browserPermission: NotificationPermission | 'unsupported';
  onToggleDarkMode: () => void;
  onSignOut: () => void;
  onOpenNewTask: (defaultModuleId?: string) => void;
  onOpenEditTask: (task: CourseTask) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onChangeTaskStatus: (task: CourseTask, nextStatus: ItemStatus) => Promise<void>;
  onSnoozeReminder: (task: CourseTask, minutes: number) => Promise<void>;
  onDismissReminder: (task: CourseTask) => Promise<void>;
  onOpenNewModule: () => void;
  onOpenEditModule: (mod: CourseModule) => void;
  onDeleteModule: (moduleId: string) => Promise<void>;
  onLoadStarterSyllabus: () => Promise<void>;
  onOpenNotifications: () => void;
  onRequestBrowserNotifications: () => Promise<void>;
  onToggleSound: () => Promise<void>;
  onUpdateLeadMinutes: (minutes: number) => Promise<void>;
  onSendTestNotification: () => void;
}

const KIND_LABELS: Record<ItemKind, string> = {
  class: 'Class',
  task: 'Task',
  assignment: 'Assignment',
};

const PRIORITY_LABELS: Record<ItemPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const DashboardWorkspace: React.FC<DashboardWorkspaceProps> = ({
  userEmail,
  userName,
  profile,
  modules,
  tasks,
  loading,
  darkMode,
  browserPermission,
  onToggleDarkMode,
  onSignOut,
  onOpenNewTask,
  onOpenEditTask,
  onDeleteTask,
  onChangeTaskStatus,
  onSnoozeReminder,
  onDismissReminder,
  onOpenNewModule,
  onOpenEditModule,
  onDeleteModule,
  onLoadStarterSyllabus,
  onOpenNotifications,
  onRequestBrowserNotifications,
  onToggleSound,
  onUpdateLeadMinutes,
  onSendTestNotification,
}) => {
  const [activeView, setActiveView] = useState<WorkspaceView>('overview');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('due_asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [seedingSyllabus, setSeedingSyllabus] = useState(false);
  const [modulePendingDelete, setModulePendingDelete] = useState<CourseModule | null>(null);
  const [deletingModule, setDeletingModule] = useState(false);

  const sortedModules = useMemo(
    () => [...modules].sort((a, b) => a.orderIndex - b.orderIndex || a.code.localeCompare(b.code)),
    [modules]
  );

  const modulesMap = useMemo(() => {
    const map: Record<string, CourseModule> = {};
    for (const mod of modules) {
      map[mod.id] = mod;
    }
    return map;
  }, [modules]);

  const leadMinutes = profile?.defaultLeadMinutes ?? 1440;
  const alerts: TaskAlert[] = useMemo(
    () => evaluateTaskAlerts(tasks, leadMinutes),
    [tasks, leadMinutes]
  );

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const overdue = tasks.filter((t) => isTaskOverdue(t)).length;

    const classes = tasks.filter((t) => t.kind === 'class');
    const classesDone = classes.filter((t) => t.status === 'completed').length;

    const studyTasks = tasks.filter((t) => t.kind === 'task');
    const studyTasksDone = studyTasks.filter((t) => t.status === 'completed').length;

    const assignments = tasks.filter((t) => t.kind === 'assignment');
    const assignmentsDone = assignments.filter((t) => t.status === 'completed').length;

    const openMinutes = tasks
      .filter((t) => t.status !== 'completed')
      .reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);

    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      open: total - completed,
      overdue,
      completionPct,
      classesTotal: classes.length,
      classesDone,
      studyTasksTotal: studyTasks.length,
      studyTasksDone,
      assignmentsTotal: assignments.length,
      assignmentsDone,
      openHours: (openMinutes / 60).toFixed(1),
    };
  }, [tasks]);

  const moduleProgressList = useMemo(() => {
    return sortedModules.map((mod) => {
      const modTasks = tasks.filter((t) => t.moduleId === mod.id);
      const done = modTasks.filter((t) => t.status === 'completed').length;
      const overdue = modTasks.filter((t) => isTaskOverdue(t)).length;
      const openMinutes = modTasks
        .filter((t) => t.status !== 'completed')
        .reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
      const pct = modTasks.length > 0 ? Math.round((done / modTasks.length) * 100) : 0;
      return {
        module: mod,
        total: modTasks.length,
        done,
        open: modTasks.length - done,
        overdue,
        pct,
        openMinutes,
      };
    });
  }, [sortedModules, tasks]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const priorityRank: Record<ItemPriority, number> = { high: 0, medium: 1, low: 2 };

    return tasks
      .filter((task) => {
        if (selectedModuleId !== 'all' && task.moduleId !== selectedModuleId) return false;
        if (kindFilter !== 'all' && task.kind !== kindFilter) return false;
        if (statusFilter === 'overdue') {
          if (!isTaskOverdue(task)) return false;
        } else if (statusFilter !== 'all' && task.status !== statusFilter) {
          return false;
        }
        if (q) {
          const mod = modulesMap[task.moduleId];
          const hay = `${task.title} ${task.notes} ${mod?.code ?? ''} ${mod?.title ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'priority_desc') {
          if (priorityRank[a.priority] !== priorityRank[b.priority]) {
            return priorityRank[a.priority] - priorityRank[b.priority];
          }
        }
        if (sortOption === 'title_asc') {
          return a.title.localeCompare(b.title);
        }
        // due_asc: completed items sink below open items, earlier dates first
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        const aTime = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER;
        const bTime = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [tasks, selectedModuleId, kindFilter, statusFilter, searchQuery, sortOption, modulesMap]);

  const upcomingOpenQueue = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'completed')
      .sort((a, b) => {
        const aTime = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER;
        const bTime = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .slice(0, 8);
  }, [tasks]);

  const breadcrumbLabel = useMemo(() => {
    if (activeView === 'overview') return 'Overview';
    if (activeView === 'modules') return 'Modules & Classes';
    if (activeView === 'reminders') return 'Reminders & Alerts';
    if (selectedModuleId !== 'all' && modulesMap[selectedModuleId]) {
      return `${modulesMap[selectedModuleId].code} · ${modulesMap[selectedModuleId].title}`;
    }
    return 'All Course Items';
  }, [activeView, selectedModuleId, modulesMap]);

  const handleLoadStarter = async () => {
    setSeedingSyllabus(true);
    try {
      await onLoadStarterSyllabus();
    } finally {
      setSeedingSyllabus(false);
    }
  };

  const handleConfirmDeleteModule = async () => {
    if (!modulePendingDelete) return;
    setDeletingModule(true);
    try {
      await onDeleteModule(modulePendingDelete.id);
      if (selectedModuleId === modulePendingDelete.id) {
        setSelectedModuleId('all');
      }
      setModulePendingDelete(null);
    } finally {
      setDeletingModule(false);
    }
  };

  const openModuleItems = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setStatusFilter('all');
    setKindFilter('all');
    setActiveView('items');
    setMobileMenuOpen(false);
  };

  const renderTaskRow = (task: CourseTask) => {
    const mod = modulesMap[task.moduleId];
    const overdue = isTaskOverdue(task);
    const isCompleted = task.status === 'completed';

    return (
      <div
        key={task.id}
        className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/50 ${
          isCompleted ? 'opacity-65' : ''
        }`}
      >
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() =>
              onChangeTaskStatus(task, isCompleted ? 'open' : 'completed')
            }
            aria-label={isCompleted ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
              isCompleted
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-slate-300 dark:border-slate-600 hover:border-indigo-600 dark:hover:border-indigo-400 bg-white dark:bg-slate-900'
            }`}
          >
            {isCompleted && <Check className="w-3.5 h-3.5" />}
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                {mod?.code || 'MODULE'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {KIND_LABELS[task.kind]}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  task.priority === 'high'
                    ? 'font-medium text-red-600 dark:text-red-400'
                    : task.priority === 'medium'
                    ? 'text-slate-600 dark:text-slate-300'
                    : 'text-slate-500 dark:text-slate-400'
                }
              >
                {PRIORITY_LABELS[task.priority]} priority
              </span>
              {overdue && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    Overdue
                  </span>
                </>
              )}
              {task.status === 'in_progress' && !overdue && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">
                    In Progress
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpenEditTask(task)}
              className={`text-left text-sm font-medium block w-full truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${
                isCompleted
                  ? 'line-through text-slate-500 dark:text-slate-400'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {task.title}
            </button>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {task.dueAt && (
                <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                  Due {formatShortDateTime(task.dueAt)}
                </span>
              )}
              {task.estimatedMinutes > 0 && (
                <>
                  {task.dueAt && <span aria-hidden="true">·</span>}
                  <span>{task.estimatedMinutes}m</span>
                </>
              )}
              {task.reminderAt && !task.reminderDismissed && !isCompleted && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                    <Bell className="w-3 h-3" />
                    {formatShortDateTime(task.reminderAt)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:shrink-0 pl-8 sm:pl-0">
          <select
            aria-label={`Status for ${task.title}`}
            value={task.status}
            onChange={(e) => onChangeTaskStatus(task, e.target.value as ItemStatus)}
            className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="open">{STATUS_LABELS.open}</option>
            <option value="in_progress">{STATUS_LABELS.in_progress}</option>
            <option value="completed">{STATUS_LABELS.completed}</option>
          </select>

          <button
            type="button"
            onClick={() => onOpenEditTask(task)}
            aria-label={`Edit ${task.title}`}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteTask(task.id)}
            aria-label={`Delete ${task.title}`}
            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 h-16 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
          Coursework
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        <nav aria-label="Workspace navigation" className="space-y-1">
          {(
            [
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'items', label: 'All Items', icon: ListTodo, count: stats.open },
              { id: 'modules', label: 'Modules & Classes', icon: Layers, count: sortedModules.length },
              { id: 'reminders', label: 'Reminders', icon: Bell, count: alerts.length },
            ] as const
          ).map((navItem) => {
            const Icon = navItem.icon;
            const active = activeView === navItem.id && (navItem.id !== 'items' || selectedModuleId === 'all');
            return (
              <button
                key={navItem.id}
                type="button"
                onClick={() => {
                  setActiveView(navItem.id);
                  if (navItem.id === 'items') setSelectedModuleId('all');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{navItem.label}</span>
                </span>
                {'count' in navItem && typeof navItem.count === 'number' && (
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {navItem.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2">
          <div className="px-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Course Modules
            </span>
            <button
              type="button"
              onClick={onOpenNewModule}
              aria-label="Add course module"
              className="p-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {sortedModules.length === 0 ? (
            <p className="px-3 text-xs text-slate-500 dark:text-slate-400">
              No modules added yet.
            </p>
          ) : (
            <div className="space-y-0.5">
              {moduleProgressList.map(({ module, done, total }) => {
                const isSelected = activeView === 'items' && selectedModuleId === module.id;
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => openModuleItems(module.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <span className="truncate">
                      <span className="font-mono mr-1.5 text-slate-500 dark:text-slate-400">
                        {module.code}
                      </span>
                      {module.title}
                    </span>
                    <span className="font-mono tabular-nums shrink-0 text-slate-500 dark:text-slate-400">
                      {done}/{total}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
              {userName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {userEmail}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:shrink-0 bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[270px] max-w-[85vw] bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 h-full z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="h-16 px-4 sm:px-8 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:inline">
                AI Course
              </span>
              <span className="text-slate-400 hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {breadcrumbLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenNotifications}
              aria-label={`Open reminders (${alerts.length} active)`}
              className="relative inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span className="hidden sm:inline">Reminders</span>
              {alerts.length > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {alerts.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenNewTask(selectedModuleId !== 'all' ? selectedModuleId : undefined)}
              disabled={sortedModules.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-6xl w-full mx-auto space-y-6">
          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className="p-5 space-y-2 animate-pulse">
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                ))}
              </div>
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/70 rounded" />
                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/70 rounded" />
              </div>
            </div>
          ) : sortedModules.length === 0 ? (
            <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 space-y-5">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Set up your AI course syllabus
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                  Organize your course into modules and classes, track assignments and study tasks, and schedule reminders so nothing slips past a deadline.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleLoadStarter}
                  disabled={seedingSyllabus}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  {seedingSyllabus ? 'Loading AI Syllabus...' : 'Load Starter AI Course Syllabus'}
                </button>
                <button
                  type="button"
                  onClick={onOpenNewModule}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <FolderPlus className="w-4 h-4" />
                  Create First Module
                </button>
              </div>
            </section>
          ) : (
            <>
              {/* OVERVIEW VIEW */}
              {activeView === 'overview' && (
                <div className="space-y-6">
                  {/* Top KPI Strip (Single-elevation structured grid) */}
                  <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
                      <div className="p-5 space-y-2">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Overall Course Progress
                        </p>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {stats.completionPct}%
                          </span>
                          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {stats.completed}/{stats.total} done
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                            style={{ width: `${stats.completionPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-5 space-y-1.5">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Classes Attended
                        </p>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {stats.classesDone}/{stats.classesTotal}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Lectures &amp; labs
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-1.5">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Study Tasks
                        </p>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {stats.studyTasksDone}/{stats.studyTasksTotal}
                          </span>
                          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {stats.openHours}h open workload
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-1.5">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Assignments Submitted
                        </p>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {stats.assignmentsDone}/{stats.assignmentsTotal}
                          </span>
                          <span
                            className={`text-xs font-medium font-mono tabular-nums ${
                              stats.overdue > 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {stats.overdue > 0 ? `${stats.overdue} overdue` : 'On schedule'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Active Reminders Strip (if any) */}
                  {alerts.length > 0 && (
                    <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Open Task Reminders &amp; Attention Queue
                          </h2>
                          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            ({alerts.length})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={onOpenNotifications}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0"
                        >
                          Manage all alerts
                        </button>
                      </div>

                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {alerts.slice(0, 4).map((alert) => {
                          const mod = modulesMap[alert.task.moduleId];
                          return (
                            <div
                              key={alert.task.id}
                              className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 text-xs">
                                  <span
                                    className={`font-semibold ${
                                      alert.category === 'overdue'
                                        ? 'text-red-600 dark:text-red-400'
                                        : alert.category === 'reminder_due'
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {alert.category === 'overdue'
                                      ? 'Overdue'
                                      : alert.category === 'reminder_due'
                                      ? 'Reminder Due'
                                      : 'Due Soon'}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-400">·</span>
                                  <span className="font-mono text-slate-600 dark:text-slate-400">
                                    {mod?.code || 'COURSE'}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-400">·</span>
                                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                    {alert.reason}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {alert.task.title}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onChangeTaskStatus(alert.task, 'completed')}
                                  className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                                >
                                  Complete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onSnoozeReminder(alert.task, 60)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                                >
                                  Snooze 1h
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Module Progress Breakdown */}
                    <section className="lg:col-span-5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Progress by Module
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveView('modules')}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0"
                        >
                          Manage modules
                        </button>
                      </div>

                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {moduleProgressList.map(({ module, total, done, overdue, pct }) => (
                          <button
                            key={module.id}
                            type="button"
                            onClick={() => openModuleItems(module.id)}
                            className="w-full text-left px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                    {module.code}
                                  </span>
                                  {overdue > 0 && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-medium text-red-600 dark:text-red-400">
                                        {overdue} overdue
                                      </span>
                                    </>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {module.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                  {done}/{total}
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              </div>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Upcoming Open Queue */}
                    <section className="lg:col-span-7 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Next Open Classes &amp; Assignments
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModuleId('all');
                            setStatusFilter('open');
                            setActiveView('items');
                          }}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0"
                        >
                          View all items
                        </button>
                      </div>

                      {upcomingOpenQueue.length === 0 ? (
                        <div className="p-10 text-center space-y-2">
                          <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            Every task is completed
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Add a new class, reading task, or assignment to continue tracking your AI course.
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-800">
                          {upcomingOpenQueue.map(renderTaskRow)}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}

              {/* ALL ITEMS VIEW */}
              {activeView === 'items' && (
                <div className="space-y-4">
                  {/* Toolbar */}
                  <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search classes, tasks, assignments, or notes..."
                          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label="Filter by module"
                          value={selectedModuleId}
                          onChange={(e) => setSelectedModuleId(e.target.value)}
                          className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="all">All Modules</option>
                          {sortedModules.map((mod) => (
                            <option key={mod.id} value={mod.id}>
                              {mod.code} — {mod.title}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label="Sort items"
                          value={sortOption}
                          onChange={(e) => setSortOption(e.target.value as SortOption)}
                          className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="due_asc">Sort: Due Date</option>
                          <option value="priority_desc">Sort: Highest Priority</option>
                          <option value="title_asc">Sort: Title A–Z</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      {/* Segmented Status Filter */}
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                        {(
                          [
                            { id: 'all', label: 'All' },
                            { id: 'open', label: 'Open' },
                            { id: 'in_progress', label: 'In Progress' },
                            { id: 'overdue', label: 'Overdue' },
                            { id: 'completed', label: 'Completed' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              statusFilter === tab.id
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Segmented Type Filter */}
                      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                        {(
                          [
                            { id: 'all', label: 'All Types' },
                            { id: 'class', label: 'Classes' },
                            { id: 'task', label: 'Tasks' },
                            { id: 'assignment', label: 'Assignments' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setKindFilter(tab.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              kindFilter === tab.id
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Items List */}
                  <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono tabular-nums">
                        Showing {filteredTasks.length} of {tasks.length} items
                      </span>
                      {(selectedModuleId !== 'all' || statusFilter !== 'all' || kindFilter !== 'all' || searchQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModuleId('all');
                            setStatusFilter('all');
                            setKindFilter('all');
                            setSearchQuery('');
                          }}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>

                    {filteredTasks.length === 0 ? (
                      <div className="p-10 text-center space-y-3">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          No matching items found
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Adjust your filters or add a new class, task, or assignment.
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenNewTask(selectedModuleId !== 'all' ? selectedModuleId : undefined)
                          }
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Course Item
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredTasks.map(renderTaskRow)}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* MODULES VIEW */}
              {activeView === 'modules' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        AI Course Modules &amp; Classes
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Organize lectures, lab sessions, and assignments by course module.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenNewModule}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Add Module
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {moduleProgressList.map(({ module, total, done, open, overdue, pct, openMinutes }) => (
                      <div
                        key={module.id}
                        className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                  {module.code}
                                </span>
                                {module.instructor && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="truncate">{module.instructor}</span>
                                  </>
                                )}
                              </div>
                              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                                {module.title}
                              </h3>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => onOpenEditModule(module)}
                                aria-label={`Edit ${module.title}`}
                                className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setModulePendingDelete(module)}
                                aria-label={`Delete ${module.title}`}
                                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              <span>{pct}% complete</span>
                              <span>
                                {done}/{total} items · {open} open
                                {overdue > 0 ? ` · ${overdue} overdue` : ''}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {(openMinutes / 60).toFixed(1)}h remaining
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openModuleItems(module.id)}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                            >
                              View Items
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenNewTask(module.id)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                            >
                              + Add Item
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REMINDERS & NOTIFICATION SETTINGS VIEW */}
              {activeView === 'reminders' && (
                <div className="space-y-6">
                  <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          Notification &amp; Reminder Preferences
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Stay ahead of live classes, study tasks, and assignment deadlines.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onRequestBrowserNotifications}
                          disabled={browserPermission === 'unsupported' || browserPermission === 'denied'}
                          className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          {browserPermission === 'granted' && profile?.enableBrowserNotifications
                            ? 'Desktop Notifications Enabled'
                            : browserPermission === 'denied'
                            ? 'Blocked by Browser'
                            : 'Enable Desktop Notifications'}
                        </button>
                        {browserPermission === 'granted' && (
                          <button
                            type="button"
                            onClick={onSendTestNotification}
                            className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            Send Test Alert
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Upcoming Deadline Warning Window
                        </label>
                        <select
                          value={profile?.defaultLeadMinutes ?? 1440}
                          onChange={(e) => onUpdateLeadMinutes(Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value={60}>1 hour before due date</option>
                          <option value={360}>6 hours before due date</option>
                          <option value={1440}>24 hours before due date</option>
                          <option value={2880}>48 hours before due date</option>
                        </select>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Open items within this window automatically appear in your Reminders queue.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          In-App Audio Chime
                        </label>
                        <div className="flex items-center justify-between px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            Play subtle chime when a task reminder triggers
                          </span>
                          <button
                            type="button"
                            onClick={onToggleSound}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              profile?.soundEnabled
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {profile?.soundEnabled ? 'On' : 'Off'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Active &amp; Upcoming Open Reminders ({alerts.length})
                      </h3>
                    </div>

                    {alerts.length === 0 ? (
                      <div className="p-10 text-center space-y-2">
                        <Calendar className="w-7 h-7 text-slate-400 mx-auto" />
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          No active reminders right now
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Add a reminder timestamp to any open task or assignment to receive alerts.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {alerts.map((alert) => {
                          const mod = modulesMap[alert.task.moduleId];
                          return (
                            <div
                              key={alert.task.id}
                              className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 text-xs">
                                  <span
                                    className={`font-semibold ${
                                      alert.category === 'overdue'
                                        ? 'text-red-600 dark:text-red-400'
                                        : alert.category === 'reminder_due'
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {alert.category === 'overdue'
                                      ? 'Overdue'
                                      : alert.category === 'reminder_due'
                                      ? 'Reminder Triggered'
                                      : 'Due Soon'}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-400">·</span>
                                  <span className="font-mono text-slate-600 dark:text-slate-400">
                                    {mod?.code || 'COURSE'}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-400">·</span>
                                  <span className="capitalize text-slate-500 dark:text-slate-400">
                                    {alert.task.kind}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onOpenEditTask(alert.task)}
                                  className="text-left text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 block"
                                >
                                  {alert.task.title}
                                </button>
                                <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                  {alert.reason}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onChangeTaskStatus(alert.task, 'completed')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Complete
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
                                    className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                  >
                                    Dismiss
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Delete Module Confirmation Dialog */}
      {modulePendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-module-title"
        >
          <div className="max-w-md w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
            <h2 id="delete-module-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Delete {modulePendingDelete.code}?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Deleting <span className="font-medium">{modulePendingDelete.title}</span> will also remove all classes, tasks, and assignments inside this module.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModulePendingDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteModule}
                disabled={deletingModule}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {deletingModule ? 'Deleting...' : 'Delete Module'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
