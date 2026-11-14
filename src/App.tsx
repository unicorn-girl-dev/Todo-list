import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Bell, BookOpen, CheckCircle2, Layers, ShieldCheck, X } from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from './lib/firebase';
import {
  CourseModule,
  CourseTask,
  generateFirestoreId,
  ItemKind,
  ItemPriority,
  ItemStatus,
  sanitizeText,
  SCHEMA_LIMITS,
  UserProfile,
} from './types/course';
import { STARTER_MODULES, STARTER_TASKS } from './data/starterSyllabus';
import {
  evaluateTaskAlerts,
  isReminderTriggered,
  playReminderChime,
  sendDesktopNotification,
} from './utils/notifications';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardWorkspace } from './components/DashboardWorkspace';
import { TaskModal } from './components/TaskModal';
import { ModuleModal } from './components/ModuleModal';
import { NotificationDrawer } from './components/NotificationDrawer';

interface InAppToast {
  id: string;
  task: CourseTask;
  title: string;
  message: string;
}

function CourseworkApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [tasks, setTasks] = useState<CourseTask[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('coursework_theme') === 'dark';
  });

  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  });

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CourseTask | null>(null);
  const [defaultModuleForNewTask, setDefaultModuleForNewTask] = useState('');

  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeToasts, setActiveToasts] = useState<InAppToast[]>([]);
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('coursework_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('coursework_theme', 'light');
    }
  }, [darkMode]);

  // Verify Firestore connectivity once on boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setProfile(null);
        setModules([]);
        setTasks([]);
        setDataLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Ensure UserProfile document exists once signed in
  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;

    async function ensureUserProfile(currentUser: User) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists() && !cancelled) {
          await setDoc(userDocRef, {
            ownerId: currentUser.uid,
            displayName: sanitizeText(
              currentUser.displayName || 'AI Course Student',
              SCHEMA_LIMITS.DISPLAY_NAME_MAX
            ),
            email: sanitizeText(
              currentUser.email || 'student@example.com',
              SCHEMA_LIMITS.EMAIL_MAX
            ),
            enableBrowserNotifications: false,
            defaultLeadMinutes: 1440,
            soundEnabled: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
      }
    }

    ensureUserProfile(user);
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  // Real-time Firestore listeners (only attached when authenticated)
  useEffect(() => {
    if (!authReady || !user) return;
    setDataLoading(true);

    let profileLoaded = false;
    let modulesLoaded = false;
    let tasksLoaded = false;

    const markLoaded = () => {
      if (profileLoaded && modulesLoaded && tasksLoaded) {
        setDataLoading(false);
      }
    };

    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setProfile({
            id: snap.id,
            ownerId: d.ownerId,
            displayName: d.displayName,
            email: d.email,
            enableBrowserNotifications: Boolean(d.enableBrowserNotifications),
            defaultLeadMinutes: Number(d.defaultLeadMinutes ?? 1440),
            soundEnabled: Boolean(d.soundEnabled ?? true),
          });
        }
        profileLoaded = true;
        markLoaded();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    );

    const modulesQuery = query(
      collection(db, 'modules'),
      where('ownerId', '==', user.uid)
    );
    const unsubModules = onSnapshot(
      modulesQuery,
      (snap) => {
        const nextModules: CourseModule[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            code: data.code,
            title: data.title,
            instructor: data.instructor || '',
            orderIndex: Number(data.orderIndex ?? 0),
          };
        });
        setModules(nextModules);
        modulesLoaded = true;
        markLoaded();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'modules');
      }
    );

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('ownerId', '==', user.uid)
    );
    const unsubTasks = onSnapshot(
      tasksQuery,
      (snap) => {
        const nextTasks: CourseTask[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            moduleId: data.moduleId,
            title: data.title,
            kind: data.kind as ItemKind,
            status: data.status as ItemStatus,
            priority: data.priority as ItemPriority,
            dueAt: data.dueAt || '',
            reminderAt: data.reminderAt || '',
            estimatedMinutes: Number(data.estimatedMinutes ?? 0),
            notes: data.notes || '',
            reminderDismissed: Boolean(data.reminderDismissed),
            completedAt: data.completedAt || '',
          };
        });
        setTasks(nextTasks);
        tasksLoaded = true;
        markLoaded();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tasks');
      }
    );

    return () => {
      unsubProfile();
      unsubModules();
      unsubTasks();
    };
  }, [authReady, user]);

  // Background 20s reminder evaluation loop
  useEffect(() => {
    if (!user || tasks.length === 0) return;

    const checkReminders = () => {
      const now = Date.now();
      for (const task of tasks) {
        if (!isReminderTriggered(task, now)) continue;
        const notificationKey = `${task.id}:${task.reminderAt}`;
        if (notifiedKeysRef.current.has(notificationKey)) continue;
        notifiedKeysRef.current.add(notificationKey);

        setActiveToasts((prev) => {
          if (prev.some((t) => t.id === notificationKey)) return prev;
          return [
            ...prev.slice(-2),
            {
              id: notificationKey,
              task,
              title: `Reminder: ${task.title}`,
              message: task.dueAt
                ? `Open ${task.kind} due ${new Date(task.dueAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`
                : `Open ${task.kind} reminder`,
            },
          ];
        });

        if (profile?.soundEnabled) {
          playReminderChime();
        }
        if (profile?.enableBrowserNotifications && browserPermission === 'granted') {
          sendDesktopNotification(`Coursework Reminder: ${task.title}`, `Open ${task.kind} needs attention.`);
        }
      }
    };

    checkReminders();
    const timer = window.setInterval(checkReminders, 20000);
    return () => window.clearInterval(timer);
  }, [user, tasks, profile?.soundEnabled, profile?.enableBrowserNotifications, browserPermission]);

  const modulesMap = useMemo(() => {
    const map: Record<string, CourseModule> = {};
    for (const m of modules) map[m.id] = m;
    return map;
  }, [modules]);

  const alerts = useMemo(
    () => evaluateTaskAlerts(tasks, profile?.defaultLeadMinutes ?? 1440),
    [tasks, profile?.defaultLeadMinutes]
  );

  const handleSignIn = async () => {
    setAuthBusy(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleSaveModule = async (payload: {
    code: string;
    title: string;
    instructor: string;
    orderIndex: number;
  }) => {
    if (!user) return;
    if (editingModule) {
      const path = `modules/${editingModule.id}`;
      try {
        await updateDoc(doc(db, 'modules', editingModule.id), {
          code: sanitizeText(payload.code, SCHEMA_LIMITS.MODULE_CODE_MAX),
          title: sanitizeText(payload.title, SCHEMA_LIMITS.MODULE_TITLE_MAX),
          instructor: sanitizeText(payload.instructor, SCHEMA_LIMITS.INSTRUCTOR_MAX),
          orderIndex: payload.orderIndex,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      const newId = generateFirestoreId('mod');
      const path = `modules/${newId}`;
      try {
        await setDoc(doc(db, 'modules', newId), {
          ownerId: user.uid,
          code: sanitizeText(payload.code, SCHEMA_LIMITS.MODULE_CODE_MAX),
          title: sanitizeText(payload.title, SCHEMA_LIMITS.MODULE_TITLE_MAX),
          instructor: sanitizeText(payload.instructor, SCHEMA_LIMITS.INSTRUCTOR_MAX),
          orderIndex: payload.orderIndex,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!user) return;
    const relatedTasks = tasks.filter((t) => t.moduleId === moduleId);
    const batch = writeBatch(db);
    for (const t of relatedTasks) {
      batch.delete(doc(db, 'tasks', t.id));
    }
    batch.delete(doc(db, 'modules', moduleId));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `modules/${moduleId}`);
    }
  };

  const handleSaveTask = async (payload: {
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
  }) => {
    if (!user) return;
    if (editingTask) {
      const path = `tasks/${editingTask.id}`;
      try {
        await updateDoc(doc(db, 'tasks', editingTask.id), {
          moduleId: payload.moduleId,
          title: sanitizeText(payload.title, SCHEMA_LIMITS.TASK_TITLE_MAX),
          kind: payload.kind,
          status: payload.status,
          priority: payload.priority,
          dueAt: sanitizeText(payload.dueAt, SCHEMA_LIMITS.DATE_ISO_MAX),
          reminderAt: sanitizeText(payload.reminderAt, SCHEMA_LIMITS.DATE_ISO_MAX),
          estimatedMinutes: payload.estimatedMinutes,
          notes: sanitizeText(payload.notes, SCHEMA_LIMITS.NOTES_MAX),
          reminderDismissed: payload.reminderDismissed,
          completedAt: sanitizeText(payload.completedAt, SCHEMA_LIMITS.DATE_ISO_MAX),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      const newId = generateFirestoreId('task');
      const path = `tasks/${newId}`;
      try {
        await setDoc(doc(db, 'tasks', newId), {
          ownerId: user.uid,
          moduleId: payload.moduleId,
          title: sanitizeText(payload.title, SCHEMA_LIMITS.TASK_TITLE_MAX),
          kind: payload.kind,
          status: payload.status,
          priority: payload.priority,
          dueAt: sanitizeText(payload.dueAt, SCHEMA_LIMITS.DATE_ISO_MAX),
          reminderAt: sanitizeText(payload.reminderAt, SCHEMA_LIMITS.DATE_ISO_MAX),
          estimatedMinutes: payload.estimatedMinutes,
          notes: sanitizeText(payload.notes, SCHEMA_LIMITS.NOTES_MAX),
          reminderDismissed: payload.reminderDismissed,
          completedAt: sanitizeText(payload.completedAt, SCHEMA_LIMITS.DATE_ISO_MAX),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const handleChangeTaskStatus = useCallback(
    async (task: CourseTask, nextStatus: ItemStatus) => {
      const path = `tasks/${task.id}`;
      try {
        await updateDoc(doc(db, 'tasks', task.id), {
          status: nextStatus,
          completedAt: nextStatus === 'completed' ? new Date().toISOString() : '',
          reminderDismissed: nextStatus === 'completed' ? true : task.reminderDismissed,
          updatedAt: serverTimestamp(),
        });
        if (nextStatus === 'completed') {
          setActiveToasts((prev) => prev.filter((t) => t.task.id !== task.id));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    []
  );

  const handleSnoozeReminder = useCallback(async (task: CourseTask, minutes: number) => {
    const nextDate = new Date(Date.now() + minutes * 60 * 1000);
    if (minutes >= 24 * 60) {
      nextDate.setHours(9, 0, 0, 0);
    }
    const path = `tasks/${task.id}`;
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        reminderAt: nextDate.toISOString(),
        reminderDismissed: false,
        updatedAt: serverTimestamp(),
      });
      setActiveToasts((prev) => prev.filter((t) => t.task.id !== task.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }, []);

  const handleDismissReminder = useCallback(async (task: CourseTask) => {
    const path = `tasks/${task.id}`;
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        reminderAt: task.reminderAt,
        reminderDismissed: true,
        updatedAt: serverTimestamp(),
      });
      setActiveToasts((prev) => prev.filter((t) => t.task.id !== task.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }, []);

  const handleLoadStarterSyllabus = async () => {
    if (!user) return;
    const now = Date.now();
    const keyToModuleId: Record<string, string> = {};

    // Commit modules first so Firestore rules `exists()` checks on tasks pass deterministically
    const modBatch = writeBatch(db);
    for (const tmpl of STARTER_MODULES) {
      const modId = generateFirestoreId('mod');
      keyToModuleId[tmpl.key] = modId;
      modBatch.set(doc(db, 'modules', modId), {
        ownerId: user.uid,
        code: tmpl.code,
        title: tmpl.title,
        instructor: tmpl.instructor,
        orderIndex: tmpl.orderIndex,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await modBatch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'modules');
    }

    const taskBatch = writeBatch(db);
    for (const t of STARTER_TASKS) {
      const taskId = generateFirestoreId('task');
      const dueMs = now + t.offsetHoursFromNow * 60 * 60 * 1000;
      const dueIso = new Date(dueMs).toISOString();
      const remIso =
        t.reminderOffsetBeforeDueHours !== null
          ? new Date(dueMs - t.reminderOffsetBeforeDueHours * 60 * 60 * 1000).toISOString()
          : '';
      taskBatch.set(doc(db, 'tasks', taskId), {
        ownerId: user.uid,
        moduleId: keyToModuleId[t.moduleKey],
        title: t.title,
        kind: t.kind,
        status: t.status,
        priority: t.priority,
        dueAt: dueIso,
        reminderAt: remIso,
        estimatedMinutes: t.estimatedMinutes,
        notes: t.notes,
        reminderDismissed: t.status === 'completed',
        completedAt: t.status === 'completed' ? new Date(dueMs).toISOString() : '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await taskBatch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tasks');
    }
  };

  const handleRequestBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window) || !user) return;
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        enableBrowserNotifications: permission === 'granted',
        updatedAt: serverTimestamp(),
      });
      if (permission === 'granted') {
        sendDesktopNotification(
          'Coursework Notifications Active',
          'You will receive desktop reminders when open AI course tasks come due.'
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleToggleSound = async () => {
    if (!user || !profile) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        soundEnabled: !profile.soundEnabled,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleUpdateLeadMinutes = async (minutes: number) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        defaultLeadMinutes: Math.max(0, Math.min(SCHEMA_LIMITS.LEAD_MINUTES_MAX, minutes)),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleSendTestNotification = () => {
    if (profile?.soundEnabled) playReminderChime();
    sendDesktopNotification(
      'Coursework Test Reminder',
      'Open task notifications are configured and working.'
    );
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120]">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
        <header className="px-6 sm:px-10 h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            Coursework
          </span>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={authBusy}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {authBusy ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-8 sm:p-10">
            <div className="md:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  AI Course Planner &amp; Progress Tracker
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 [text-wrap:balance]">
                  Keep every class, task, and assignment on schedule.
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Organize multi-week AI coursework into structured modules, monitor real completion rates across lectures and labs, and get timely reminders for open tasks before deadlines slip.
                </p>
              </div>

              {authError && (
                <div className="px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
                  {authError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={authBusy}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {authBusy ? 'Connecting...' : 'Continue with Google'}
                </button>
              </div>
            </div>

            <div className="md:col-span-5 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-6 md:pt-0 md:pl-8 flex flex-col justify-center space-y-4">
              <div className="flex items-start gap-3">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Module-level syllabi</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Separate lectures, study tasks, and graded assignments cleanly.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Completion telemetry</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Track remaining study hours and per-class progress bars.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Open-task reminders</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Desktop alerts, snooze controls, and overdue prioritization.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Private cloud sync</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your syllabus and tasks stay synced to your Google account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="px-6 py-4 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Coursework Study Workspace
          </span>
        </footer>
      </div>
    );
  }

  return (
    <>
      <DashboardWorkspace
        userEmail={user.email || ''}
        userName={profile?.displayName || user.displayName || 'Student'}
        profile={profile}
        modules={modules}
        tasks={tasks}
        loading={dataLoading}
        darkMode={darkMode}
        browserPermission={browserPermission}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onSignOut={handleSignOut}
        onOpenNewTask={(defaultModId) => {
          setEditingTask(null);
          setDefaultModuleForNewTask(defaultModId || modules[0]?.id || '');
          setTaskModalOpen(true);
        }}
        onOpenEditTask={(task) => {
          setEditingTask(task);
          setDefaultModuleForNewTask(task.moduleId);
          setTaskModalOpen(true);
        }}
        onDeleteTask={handleDeleteTask}
        onChangeTaskStatus={handleChangeTaskStatus}
        onSnoozeReminder={handleSnoozeReminder}
        onDismissReminder={handleDismissReminder}
        onOpenNewModule={() => {
          setEditingModule(null);
          setModuleModalOpen(true);
        }}
        onOpenEditModule={(mod) => {
          setEditingModule(mod);
          setModuleModalOpen(true);
        }}
        onDeleteModule={handleDeleteModule}
        onLoadStarterSyllabus={handleLoadStarterSyllabus}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onRequestBrowserNotifications={handleRequestBrowserNotifications}
        onToggleSound={handleToggleSound}
        onUpdateLeadMinutes={handleUpdateLeadMinutes}
        onSendTestNotification={handleSendTestNotification}
      />

      <TaskModal
        isOpen={taskModalOpen}
        initialTask={editingTask}
        modules={[...modules].sort((a, b) => a.orderIndex - b.orderIndex)}
        defaultModuleId={defaultModuleForNewTask}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
      />

      <ModuleModal
        isOpen={moduleModalOpen}
        initialModule={editingModule}
        nextOrderIndex={modules.length + 1}
        onClose={() => {
          setModuleModalOpen(false);
          setEditingModule(null);
        }}
        onSave={handleSaveModule}
      />

      <NotificationDrawer
        isOpen={notificationsOpen}
        alerts={alerts}
        modulesMap={modulesMap}
        profile={profile}
        browserPermission={browserPermission}
        onClose={() => setNotificationsOpen(false)}
        onCompleteTask={(task) => handleChangeTaskStatus(task, 'completed')}
        onSnoozeReminder={handleSnoozeReminder}
        onDismissReminder={handleDismissReminder}
        onEditTask={(task) => {
          setEditingTask(task);
          setDefaultModuleForNewTask(task.moduleId);
          setTaskModalOpen(true);
        }}
        onRequestBrowserNotifications={handleRequestBrowserNotifications}
        onToggleSound={handleToggleSound}
        onSendTestNotification={handleSendTestNotification}
      />

      {/* Real-time Reminder Toasts */}
      {activeToasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)]">
          {activeToasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-lg space-y-2.5"
              role="status"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {toast.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {toast.message}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismissReminder(toast.task)}
                  aria-label="Dismiss reminder toast"
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <button
                  type="button"
                  onClick={() => handleChangeTaskStatus(toast.task, 'completed')}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Mark Complete
                </button>
                <button
                  type="button"
                  onClick={() => handleSnoozeReminder(toast.task, 60)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Snooze 1h
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CourseworkApp />
    </ErrorBoundary>
  );
}
