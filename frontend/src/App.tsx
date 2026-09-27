import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Task, TaskStatus } from './types';
import { api, extractErrorMessage } from './services/api';
import { soundManager } from './utils/sound';
import { themeManager, ThemeMode } from './utils/theme';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { TopBar, FilterChip } from './components/TopBar';
import { HeroSection } from './components/HeroSection';
import { StatCards } from './components/StatCards';
import { KanbanBoard } from './components/KanbanBoard';
import { TimelineView } from './components/TimelineView';
import { DependencyGraphView } from './components/DependencyGraphView';
import { TaskDetailModal } from './components/TaskDetailModal';
import { NewTaskModal } from './components/NewTaskModal';
import { CriticalPathBanner } from './components/CriticalPathBanner';
import { TeamHealthMetrics } from './components/TeamHealthMetrics';
import { calculateCriticalPath } from './utils/criticalPath';
import {
  AlertTriangle,
  Loader2,
  CheckCircle2,
  RotateCcw,
  X,
  Zap,
  LayoutGrid,
  CalendarRange,
  Network,
  Plus,
} from 'lucide-react';

interface ToastItem {
  id: string;
  type: 'move' | 'unblock' | 'revert';
  title: string;
  message: string;
  unblockedCount?: number;
  unblockedTitles?: string[];
  onUndo?: () => Promise<void>;
}

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Active navigation view
  const [activeTab, setActiveTab] = useState<ActiveTab>('board');

  // Search filter & filter chips
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterChip, setActiveFilterChip] = useState<FilterChip>('all');

  // Selected task for detail panel
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // New task modal
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // Blocked card drag warning
  const [blockedDragWarning, setBlockedDragWarning] = useState<string | null>(null);
  const [warnedTaskId, setWarnedTaskId] = useState<string | null>(null);

  // Newly unblocked task IDs for green pulse highlight
  const [justUnblockedTaskIds, setJustUnblockedTaskIds] = useState<string[]>([]);

  // Toast notification state
  const [toast, setToast] = useState<ToastItem | null>(null);

  // Sound toggle state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundManager.isEnabled());

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setEnabled(next);
  };

  // Theme toggle state ('light' | 'dark' with persistence)
  const [theme, setTheme] = useState<ThemeMode>(() => themeManager.getInitialTheme());

  useEffect(() => {
    themeManager.applyTheme(theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      themeManager.applyTheme(next);
      return next;
    });
  };

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Fetch tasks from API
  const fetchTasks = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    setGeneralError(null);

    try {
      const data = await api.getTasks();
      setTasks(data);
      setApiConnected(api.isBackendOnline());
    } catch (err: unknown) {
      setApiConnected(false);
      const msg = extractErrorMessage(err);
      setGeneralError(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Derived selected task (always fresh from tasks array)
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  // Visual Critical Path (Longest chain in the DAG)
  const criticalPath = useMemo(() => calculateCriticalPath(tasks), [tasks]);

  const formatColName = (status: TaskStatus): string => {
    if (status === 'BACKLOG') return 'Backlog';
    if (status === 'IN_PROGRESS') return 'In Progress';
    if (status === 'REVIEW') return 'Review';
    return 'Done';
  };

  // Handle status update via drag & drop or quick action button
  const handleStatusChange = async (
    taskId: string,
    newStatus: TaskStatus,
    newIndex: number
  ) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const prevStatus = targetTask.status;
    const prevIndex = targetTask.boardPosition;
    const taskTitle = targetTask.title;

    // Record blocked tasks before this update
    const beforeBlockedSet = new Set(tasks.filter((t) => t.blocked).map((t) => t.id));

    try {
      await api.updateTask(taskId, {
        status: newStatus,
        boardPosition: newIndex,
      });

      // Refetch tasks with newly recalculated DAG constraints
      const updatedTasks = await api.getTasks();
      setTasks(updatedTasks);
      setApiConnected(api.isBackendOnline());

      // Detect any tasks that were blocked before and are now cleared/ready
      const newlyUnblocked = updatedTasks.filter((t) => beforeBlockedSet.has(t.id) && !t.blocked);

      if (newlyUnblocked.length > 0) {
        // Trigger green flash highlights on newly unblocked cards
        setJustUnblockedTaskIds(newlyUnblocked.map((t) => t.id));
        soundManager.playDependencyResolved();

        // Celebration Toast showing dependency resolution
        setToast({
          id: Date.now().toString(),
          type: 'unblock',
          title: `⚡ ${newlyUnblocked.length} task${newlyUnblocked.length > 1 ? 's' : ''} now ready!`,
          message: `"${taskTitle}" completed → unblocked: ${newlyUnblocked.map((t) => t.title).join(', ')}`,
          unblockedCount: newlyUnblocked.length,
          unblockedTitles: newlyUnblocked.map((t) => t.title),
          onUndo: async () => {
            soundManager.playUndo();
            await api.updateTask(taskId, { status: prevStatus, boardPosition: prevIndex });
            await fetchTasks(true);
            setJustUnblockedTaskIds([]);
            setToast({
              id: Date.now().toString(),
              type: 'revert',
              title: 'Move Reverted',
              message: `Restored "${taskTitle}" to ${formatColName(prevStatus)}.`,
            });
          },
        });

        // Clear green highlight after 4s
        setTimeout(() => {
          setJustUnblockedTaskIds([]);
        }, 4000);
      } else {
        // Standard smooth move
        soundManager.playCardMoved();

        setToast({
          id: Date.now().toString(),
          type: 'move',
          title: `"${taskTitle}" moved to ${formatColName(newStatus)}`,
          message: `Column updated on Kanban board.`,
          onUndo: async () => {
            soundManager.playUndo();
            await api.updateTask(taskId, { status: prevStatus, boardPosition: prevIndex });
            await fetchTasks(true);
            setToast({
              id: Date.now().toString(),
              type: 'revert',
              title: 'Move Reverted',
              message: `Restored "${taskTitle}" to ${formatColName(prevStatus)}.`,
            });
          },
        });
      }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setGeneralError(`Failed to update task status: ${msg}`);
      await fetchTasks(true);
    }
  };

  // Filter tasks by active filter chip and search query
  const filteredTasks = useMemo(() => {
    let list = tasks;

    // 1. Filter by chip
    if (activeFilterChip === 'blocked') {
      list = list.filter((t) => t.blocked);
    } else if (activeFilterChip === 'ready') {
      list = list.filter((t) => !t.blocked && t.status !== 'DONE');
    } else if (activeFilterChip === 'high_priority') {
      list = list.filter((t) => {
        const deps = tasks.filter((other) => other.prerequisiteIds?.includes(t.id));
        return deps.length >= 2 || (t.blocked && (t.prerequisiteIds?.length || 0) >= 2);
      });
    } else if (activeFilterChip === 'due_soon') {
      const now = new Date().getTime();
      list = list.filter((t) => {
        if (t.status === 'DONE' || !t.endDate) return false;
        const diff = (new Date(t.endDate).getTime() - now) / 86400000;
        return diff <= 4;
      });
    } else if (activeFilterChip === 'keystone') {
      list = list.filter((t) => {
        const deps = tasks.filter((other) => other.prerequisiteIds?.includes(t.id));
        return deps.length >= 2;
      });
    } else if (activeFilterChip === 'leaf') {
      list = list.filter((t) => {
        const deps = tasks.filter((other) => other.prerequisiteIds?.includes(t.id));
        return deps.length === 0;
      });
    }

    // 2. Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => {
        const titleMatch = t.title.toLowerCase().includes(q);
        const descMatch = t.description?.toLowerCase().includes(q);
        const statusMatch = t.status.toLowerCase().includes(q);
        const blockedMatch = t.blockedReason?.toLowerCase().includes(q);
        return titleMatch || descMatch || statusMatch || blockedMatch;
      });
    }

    return list;
  }, [tasks, searchQuery, activeFilterChip]);

  return (
    <div className="min-h-screen bg-cream-100 dark:bg-dark-bg text-ink-900 dark:text-slate-100 flex font-sans transition-colors duration-300">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiConnected={apiConnected}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen">
        {/* Top Bar with Autocomplete Search, Sound Toggle, Theme Toggle & Filter Chips */}
        <TopBar
          tasks={tasks}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeFilterChip={activeFilterChip}
          setActiveFilterChip={setActiveFilterChip}
          onSelectTask={(task) => setSelectedTaskId(task.id)}
          onNewTaskClick={() => setIsNewTaskOpen(true)}
          onRefreshClick={() => fetchTasks(false)}
          isRefreshing={isRefreshing}
          totalFilteredCount={filteredTasks.length}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* Content Container */}
        <main className="p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1 pb-24 md:pb-8">
          {/* Global Network/Server Error Alert */}
          {generalError && (
            <div className="mb-6 p-4 rounded-lg bg-badge-blockedBg border border-badge-blockedBorder text-badge-blocked flex items-start justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed font-mono">
                  <span className="font-semibold block mb-0.5">API Server Notice:</span>
                  {generalError}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGeneralError(null)}
                className="text-xs text-badge-blocked hover:opacity-70 font-mono px-2 py-0.5 rounded border border-badge-blockedBorder"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Placeholder Engine Notice when backend is offline */}
          {apiConnected === false && !generalError && (
            <div className="mb-6 px-4 py-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-950 flex items-center justify-between text-xs font-mono shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span>
                  <strong>Placeholder Mode:</strong> Backend (localhost:8080) is offline. Running with interactive local DAG engine (9 seeded tasks, drag-and-drop, blocker tracking, Gantt, and cycle detection).
                </span>
              </div>
              <button
                type="button"
                onClick={() => fetchTasks(false)}
                className="px-2.5 py-1 rounded bg-white hover:bg-cream-100 border border-amber-300 text-[11px] text-amber-900 font-semibold transition-colors shrink-0 ml-3"
              >
                Retry 8080
              </button>
            </div>
          )}

          {/* Hero Section */}
          <HeroSection />

          {/* 4 Summary Stat Cards */}
          <StatCards tasks={tasks} />

          {/* Visual Critical Path Banner & Warning Callout */}
          {!loading && (
            <CriticalPathBanner
              criticalPath={criticalPath}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
            />
          )}

          {/* Team Health, Blocked Risk & Burndown Metrics */}
          {!loading && (
            <TeamHealthMetrics
              tasks={tasks}
              criticalPath={criticalPath}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
            />
          )}

          {/* Loading Skeleton */}
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-warmgray-border rounded-lg bg-cream-50/50">
              <Loader2 className="w-8 h-8 animate-spin text-terracotta mb-2" />
              <span className="text-xs text-ink-500 font-mono">
                Connecting to DAG Dependency Engine at localhost:8080...
              </span>
            </div>
          ) : (
            <>
              {/* Tab Views */}
              {activeTab === 'board' && (
                <KanbanBoard
                  tasks={filteredTasks}
                  onTaskClick={(t) => setSelectedTaskId(t.id)}
                  onStatusChange={handleStatusChange}
                  blockedDragWarning={blockedDragWarning}
                  setBlockedDragWarning={setBlockedDragWarning}
                  warnedTaskId={warnedTaskId}
                  setWarnedTaskId={setWarnedTaskId}
                  justUnblockedTaskIds={justUnblockedTaskIds}
                />
              )}

              {activeTab === 'timeline' && (
                <TimelineView
                  tasks={filteredTasks}
                  onTaskClick={(t) => setSelectedTaskId(t.id)}
                />
              )}

              {activeTab === 'dependencies' && (
                <DependencyGraphView
                  tasks={filteredTasks}
                  onTaskClick={(t) => setSelectedTaskId(t.id)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Floating Action Button (FAB) for "New Task" */}
      <button
        type="button"
        onClick={() => setIsNewTaskOpen(true)}
        aria-label="Create new task"
        className="fixed bottom-18 right-5 md:hidden z-40 bg-terracotta hover:bg-terracotta-hover active:scale-95 text-white p-3.5 rounded-full shadow-2xl transition-all duration-200 flex items-center justify-center border-2 border-white dark:border-dark-border"
        title="Create new task"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-cream-50/95 dark:bg-dark-surface/95 backdrop-blur-md border-t border-warmgray-border dark:border-dark-border py-2 px-6 flex items-center justify-around shadow-lg transition-colors">
        <button
          type="button"
          onClick={() => setActiveTab('board')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'board'
              ? 'text-terracotta dark:text-neon-orange font-semibold'
              : 'text-ink-400 dark:text-slate-400 hover:text-ink-700'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] font-mono tracking-tight">Board</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'timeline'
              ? 'text-terracotta dark:text-neon-orange font-semibold'
              : 'text-ink-400 dark:text-slate-400 hover:text-ink-700'
          }`}
        >
          <CalendarRange className="w-5 h-5" />
          <span className="text-[10px] font-mono tracking-tight">Timeline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dependencies')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'dependencies'
              ? 'text-terracotta dark:text-neon-orange font-semibold'
              : 'text-ink-400 dark:text-slate-400 hover:text-ink-700'
          }`}
        >
          <Network className="w-5 h-5" />
          <span className="text-[10px] font-mono tracking-tight">Tree/DAG</span>
        </button>
      </nav>

      {/* Task Detail Modal / Slide-over Drawer */}
      <TaskDetailModal
        task={selectedTask}
        allTasks={tasks}
        onClose={() => setSelectedTaskId(null)}
        onRefreshTasks={() => fetchTasks(true)}
      />

      {/* New Task Modal */}
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onSuccess={() => fetchTasks(false)}
      />

      {/* Interactive Toast Notification with Undo & Dependency Resolution */}
      {toast && (
        <div
          key={toast.id}
          className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-xl shadow-2xl p-4 animate-toast-slide-up select-none flex items-start justify-between gap-3 text-ink-900 dark:text-slate-100"
        >
          <div className="flex items-start gap-3 min-w-0">
            {toast.type === 'unblock' ? (
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-400 animate-bounce">
                <Zap className="w-4 h-4 fill-emerald-500 text-emerald-700 dark:text-emerald-400" />
              </div>
            ) : toast.type === 'revert' ? (
              <div className="w-8 h-8 rounded-lg bg-cream-200 dark:bg-dark-surface border border-warmgray-border dark:border-dark-border flex items-center justify-center shrink-0 text-ink-600 dark:text-slate-300">
                <RotateCcw className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-terracotta-light dark:bg-orange-950/40 border border-terracotta-border dark:border-orange-800/60 flex items-center justify-center shrink-0 text-terracotta dark:text-neon-orange">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-ink-900 dark:text-slate-100 font-mono flex items-center gap-1.5 truncate">
                {toast.title}
              </h4>
              <p className="text-[11px] text-ink-500 dark:text-slate-400 mt-0.5 leading-snug break-words">
                {toast.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-center">
            {toast.onUndo && (
              <button
                type="button"
                onClick={async () => {
                  const undo = toast.onUndo;
                  setToast(null);
                  if (undo) await undo();
                }}
                className="px-2.5 py-1 rounded bg-cream-200 dark:bg-dark-surface hover:bg-cream-300 dark:hover:bg-dark-cardHover text-ink-800 dark:text-slate-200 border border-warmgray-border dark:border-dark-border text-xs font-mono font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                title="Undo last card move"
              >
                <RotateCcw className="w-3 h-3 text-ink-600 dark:text-slate-300" />
                <span>Undo</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 text-ink-400 hover:text-ink-700 dark:text-slate-400 dark:hover:text-slate-200 rounded transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
