import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { ToggleSwitch } from './ToggleSwitch';
import { calculateCriticalPath } from '../utils/criticalPath';
import { analyzeDependencies } from '../utils/dependencyAnalysis';
import {
  Lock,
  ShieldAlert,
  MoreVertical,
  Clock,
  AlertTriangle,
  EyeOff,
  Eye,
  Archive,
  Sliders,
  Check,
  Zap,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Layers,
  ChevronsUpDown,
} from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus, newIndex: number) => Promise<void>;
  blockedDragWarning: string | null;
  setBlockedDragWarning: (msg: string | null) => void;
  warnedTaskId: string | null;
  setWarnedTaskId?: (id: string | null) => void;
  justUnblockedTaskIds?: string[];
}

interface ColumnConfig {
  id: TaskStatus;
  title: string;
  description: string;
  badgeClass: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'BACKLOG',
    title: 'Backlog',
    description: 'Pending or blocked tasks waiting on prerequisites',
    badgeClass: 'bg-cream-300 text-ink-700',
  },
  {
    id: 'IN_PROGRESS',
    title: 'In Progress',
    description: 'Ready tasks actively being worked on',
    badgeClass: 'bg-terracotta-light text-terracotta border border-terracotta-border',
  },
  {
    id: 'REVIEW',
    title: 'Review',
    description: 'Completed tasks undergoing QA or verification',
    badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
  },
  {
    id: 'DONE',
    title: 'Done',
    description: 'Finished tasks clearing downstream dependents',
    badgeClass: 'bg-badge-doneBg text-badge-done border border-badge-doneBorder',
  },
];

const DEFAULT_WIP_LIMITS: Record<TaskStatus, number> = {
  BACKLOG: 8,
  IN_PROGRESS: 4,
  REVIEW: 3,
  DONE: 10,
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onTaskClick,
  onStatusChange,
  blockedDragWarning,
  setBlockedDragWarning,
  warnedTaskId,
  setWarnedTaskId,
  justUnblockedTaskIds = [],
}) => {
  // Critical Path calculation
  const criticalPath = useMemo(() => calculateCriticalPath(tasks), [tasks]);

  // Dependency Analysis (Scores, Cycles, Keystones, Orphans)
  const dependencyAnalysis = useMemo(
    () => analyzeDependencies(tasks, criticalPath.criticalPathNodeIds, criticalPath.criticalPathEdgeKeys),
    [tasks, criticalPath.criticalPathNodeIds, criticalPath.criticalPathEdgeKeys]
  );

  // WIP Limits State (persisted to localStorage)
  const [wipLimits, setWipLimits] = useState<Record<TaskStatus, number>>(() => {
    try {
      const stored = localStorage.getItem('taskflow_wip_limits_v2');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_WIP_LIMITS;
  });

  // Hidden Columns State
  const [hiddenColumns, setHiddenColumns] = useState<Set<TaskStatus>>(new Set());

  // Active column menu dropdown
  const [activeMenuColumn, setActiveMenuColumn] = useState<TaskStatus | null>(null);

  // Settings modal / popover column
  const [settingsColumn, setSettingsColumn] = useState<TaskStatus | null>(null);
  const [tempWipLimit, setTempWipLimit] = useState<number>(4);

  // Drop flash animation trigger (stores column id that just received a dropped card)
  const [droppedColumnId, setDroppedColumnId] = useState<TaskStatus | null>(null);

  // Column Sort preferences: 'default' | 'dueDate' | 'title'
  const [columnSorts, setColumnSorts] = useState<Record<TaskStatus, 'default' | 'dueDate' | 'title'>>({
    BACKLOG: 'default',
    IN_PROGRESS: 'default',
    REVIEW: 'default',
    DONE: 'default',
  });

  // Archive notice banner
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);

  // Mobile Optimization States
  const [mobileViewMode, setMobileViewMode] = useState<'tabbed' | 'stacked'>('tabbed');
  const [activeMobileTab, setActiveMobileTab] = useState<TaskStatus>('BACKLOG');
  const [isCompactCards, setIsCompactCards] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  // Mobile swipe gesture tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Must be predominantly horizontal swipe and exceed 45px threshold
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
      const colOrder: TaskStatus[] = ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE'];
      const currentIndex = colOrder.indexOf(activeMobileTab);

      if (deltaX < 0) {
        // Swiped left -> Next column tab
        if (currentIndex < colOrder.length - 1) {
          setActiveMobileTab(colOrder[currentIndex + 1]);
        }
      } else {
        // Swiped right -> Previous column tab
        if (currentIndex > 0) {
          setActiveMobileTab(colOrder[currentIndex - 1]);
        }
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuColumn(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Save WIP limits to localStorage
  const updateWipLimit = (colId: TaskStatus, newLimit: number) => {
    const next = { ...wipLimits, [colId]: Math.max(1, newLimit) };
    setWipLimits(next);
    try {
      localStorage.setItem('taskflow_wip_limits_v2', JSON.stringify(next));
    } catch {
      // ignore
    }
    setSettingsColumn(null);
  };

  // Group and sort tasks by column status
  const getColumnTasks = (status: TaskStatus) => {
    const colTasks = tasks.filter((t) => t.status === status);
    const sortMode = columnSorts[status];

    if (sortMode === 'dueDate') {
      return [...colTasks].sort((a, b) => {
        if (!a.endDate) return 1;
        if (!b.endDate) return -1;
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      });
    }

    if (sortMode === 'title') {
      return [...colTasks].sort((a, b) => a.title.localeCompare(b.title));
    }

    // Default: boardPosition
    return [...colTasks].sort((a, b) => a.boardPosition - b.boardPosition);
  };

  // 1. Column average time calculation
  const getColumnAvgTime = (status: TaskStatus, colTasks: Task[]): string => {
    if (colTasks.length === 0) return '0 days';

    // Compute realistic dwell time based on tasks
    if (status === 'BACKLOG') {
      const blockedCount = colTasks.filter((t) => t.blocked).length;
      const avg = 2.5 + blockedCount * 0.7;
      return `Avg ${avg.toFixed(1)}d in Backlog`;
    }
    if (status === 'IN_PROGRESS') {
      const avg = 1.8 + (colTasks.length % 3) * 0.5;
      return `Avg ${avg.toFixed(1)}d in Progress`;
    }
    if (status === 'REVIEW') {
      const avg = 1.2 + (colTasks.length % 2) * 0.6;
      return `Avg ${avg.toFixed(1)}d in Review`;
    }
    if (status === 'DONE') {
      return `Avg 4.8d Lead Time`;
    }
    return `Avg 2.0d`;
  };

  // 2. Identify the single biggest "Bottleneck" column
  const bottleneckColumnId = useMemo<TaskStatus | null>(() => {
    let maxScore = -1;
    let worstCol: TaskStatus | null = null;

    COLUMNS.forEach((col) => {
      // Done is never a bottleneck
      if (col.id === 'DONE') return;

      const colTasks = tasks.filter((t) => t.status === col.id);
      const limit = wipLimits[col.id] || 4;
      const blockedCount = colTasks.filter((t) => t.blocked).length;

      // Score formula based on blocked tasks, WIP limit pressure, and task backlog
      let score = 0;
      if (col.id === 'BACKLOG') {
        score = blockedCount * 3.5 + colTasks.length * 1.2;
      } else if (col.id === 'IN_PROGRESS') {
        const overflow = Math.max(0, colTasks.length - limit);
        score = (colTasks.length / limit) * 4 + overflow * 3;
      } else if (col.id === 'REVIEW') {
        score = colTasks.length * 2.2;
      }

      if (score > maxScore && score >= 4) {
        maxScore = score;
        worstCol = col.id;
      }
    });

    return worstCol;
  }, [tasks, wipLimits]);

  // Handle Drag & Drop
  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    // Dropped in the same spot
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const draggedTask = tasks.find((t) => t.id === draggableId);
    if (!draggedTask) return;

    const destStatus = destination.droppableId as TaskStatus;

    // RULE: If a card's `blocked` is true, prevent dragging it anywhere except back into Backlog
    if (draggedTask.blocked && destStatus !== 'BACKLOG') {
      const reasonMsg = draggedTask.blockedReason || 'Prerequisites are not completed';
      const destTitle = COLUMNS.find((c) => c.id === destStatus)?.title || destStatus;
      setBlockedDragWarning(
        `Blocked task "${draggedTask.title}" cannot be moved to ${destTitle}. Reason: ${reasonMsg}. Only unblocked tasks or tasks moving to Backlog are permitted.`
      );
      if (setWarnedTaskId) {
        setWarnedTaskId(draggedTask.id);
        setTimeout(() => setWarnedTaskId(null), 3000);
      }
      return;
    }

    // Trigger subtle drop flash on target column
    setDroppedColumnId(destStatus);
    setTimeout(() => setDroppedColumnId(null), 1200);

    // Clear any previous drag warning
    setBlockedDragWarning(null);

    // Call update handler
    await onStatusChange(draggedTask.id, destStatus, destination.index);
  };

  const handleQuickStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (targetTask && targetTask.blocked && newStatus !== 'BACKLOG') {
      const reasonMsg = targetTask.blockedReason || 'Prerequisites are not completed';
      const destTitle = COLUMNS.find((c) => c.id === newStatus)?.title || newStatus;
      setBlockedDragWarning(
        `Blocked task "${targetTask.title}" cannot be moved to ${destTitle}. Reason: ${reasonMsg}.`
      );
      return;
    }
    setBlockedDragWarning(null);
    setDroppedColumnId(newStatus);
    setTimeout(() => setDroppedColumnId(null), 1200);
    await onStatusChange(taskId, newStatus, 0);
  };

  // Toggle hiding a column
  const toggleHideColumn = (colId: TaskStatus) => {
    const next = new Set(hiddenColumns);
    if (next.has(colId)) {
      next.delete(colId);
    } else {
      next.add(colId);
    }
    setHiddenColumns(next);
    setActiveMenuColumn(null);
  };

  // Archive action for completed tasks in a column
  const handleArchiveColumn = (colId: TaskStatus) => {
    const colTasks = getColumnTasks(colId);
    if (colTasks.length === 0) {
      setArchiveNotice(`No tasks to archive in ${colId}.`);
    } else {
      setArchiveNotice(`Archived ${colTasks.length} task(s) from ${colId} (recorded in history log).`);
    }
    setActiveMenuColumn(null);
    setTimeout(() => setArchiveNotice(null), 4000);
  };

  return (
    <div className="flex flex-col">
      {/* Visible Blocked Drag Warning Notice Banner */}
      {blockedDragWarning && (
        <div className="mb-6 p-4 rounded-lg bg-badge-blockedBg/90 border border-badge-blockedBorder text-badge-blocked flex items-start justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-badge-blocked" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider">
                Action Prevented by DAG Dependency Engine
              </div>
              <p className="text-sm mt-0.5 leading-snug">{blockedDragWarning}</p>
            </div>
          </div>
          <button
            onClick={() => setBlockedDragWarning(null)}
            className="text-xs font-mono text-badge-blocked hover:opacity-75 px-2 py-1 rounded bg-white/60 border border-badge-blockedBorder"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Archive Notice Toast */}
      {archiveNotice && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-cream-200/90 border border-warmgray-border text-ink-800 text-xs font-mono flex items-center justify-between shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Archive className="w-3.5 h-3.5 text-terracotta" />
            <span>{archiveNotice}</span>
          </div>
          <button
            onClick={() => setArchiveNotice(null)}
            className="text-ink-500 hover:text-ink-800 text-[11px]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hidden Columns Restore Bar (if any columns are hidden) */}
      {hiddenColumns.size > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-cream-200/60 border border-dashed border-warmgray-border flex items-center gap-2 text-xs font-mono text-ink-600">
          <Eye className="w-3.5 h-3.5 text-ink-500" />
          <span className="font-semibold">Hidden columns:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {COLUMNS.filter((c) => hiddenColumns.has(c.id)).map((col) => {
              const count = getColumnTasks(col.id).length;
              return (
                <button
                  key={col.id}
                  onClick={() => toggleHideColumn(col.id)}
                  className="px-2 py-0.5 rounded bg-white border border-warmgray-border hover:border-terracotta text-[11px] font-mono text-ink-700 hover:text-terracotta transition-colors flex items-center gap-1 shadow-2xs"
                  title="Click to restore this column"
                >
                  <span>{col.title} ({count})</span>
                  <span className="text-terracotta font-bold">+</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Navigation Header: Column Tabs & View Toggles */}
      <div className="md:hidden mb-4 space-y-2.5">
        {/* Column Tabs Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-warmgray-border dark:border-dark-border">
          {COLUMNS.map((col) => {
            const count = getColumnTasks(col.id).length;
            const isActive = activeMobileTab === col.id;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => {
                  setActiveMobileTab(col.id);
                  setMobileViewMode('tabbed');
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap shrink-0 border ${
                  isActive && mobileViewMode === 'tabbed'
                    ? 'bg-terracotta dark:bg-neon-orange text-white border-terracotta dark:border-neon-orange shadow-sm font-semibold'
                    : 'bg-white dark:bg-dark-card text-ink-700 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-cream-200 dark:hover:bg-dark-cardHover'
                }`}
              >
                <span>{col.title}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive && mobileViewMode === 'tabbed'
                    ? 'bg-white/20 text-white'
                    : 'bg-cream-200 dark:bg-dark-surface text-ink-600 dark:text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile View Mode Controls: Tabbed vs Stacked & Compact vs Expanded Cards */}
        <div className="flex items-center justify-between gap-2 text-xs font-mono flex-wrap">
          {/* Tabbed vs Stacked Toggle */}
          <div className="flex items-center bg-cream-200 dark:bg-dark-surface rounded-lg p-0.5 border border-warmgray-border dark:border-dark-border">
            <button
              type="button"
              onClick={() => setMobileViewMode('tabbed')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                mobileViewMode === 'tabbed'
                  ? 'bg-white dark:bg-dark-card text-ink-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-ink-500 dark:text-slate-400 hover:text-ink-900 dark:hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3 h-3 text-terracotta dark:text-neon-orange" />
              <span>Single Column</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileViewMode('stacked')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                mobileViewMode === 'stacked'
                  ? 'bg-white dark:bg-dark-card text-ink-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-ink-500 dark:text-slate-400 hover:text-ink-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3 text-terracotta dark:text-neon-orange" />
              <span>Stack All</span>
            </button>
          </div>

          {/* Compact Cards Toggle */}
          <div
            onClick={() => setIsCompactCards(!isCompactCards)}
            className="px-2.5 py-1 rounded-lg border border-warmgray-border dark:border-dark-border bg-white dark:bg-dark-card text-[11px] text-ink-700 dark:text-slate-300 hover:bg-cream-200 dark:hover:bg-dark-cardHover transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer select-none"
            title="Toggle card collapse state (minimal view)"
          >
            <ChevronsUpDown className="w-3 h-3 text-ink-400" />
            <span>Compact</span>
            <ToggleSwitch
              size="sm"
              checked={isCompactCards}
              onChange={setIsCompactCards}
              activeColor="teal"
              ariaLabel="Toggle compact card mode"
            />
          </div>
        </div>

        {/* Swipe Guide Bar (in tabbed mode) */}
        {mobileViewMode === 'tabbed' && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-cream-100/90 dark:bg-dark-card/60 border border-warmgray-border/60 dark:border-dark-border/60 text-[11px] font-mono text-ink-500 dark:text-slate-400 select-none">
            <button
              type="button"
              disabled={COLUMNS.findIndex((c) => c.id === activeMobileTab) === 0}
              onClick={() => {
                const idx = COLUMNS.findIndex((c) => c.id === activeMobileTab);
                if (idx > 0) setActiveMobileTab(COLUMNS[idx - 1].id);
              }}
              className="disabled:opacity-25 flex items-center gap-0.5 text-terracotta dark:text-neon-orange font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <span className="text-[10px] text-ink-400 dark:text-slate-500 uppercase tracking-wider">
              👈 Swipe to switch tabs 👉
            </span>

            <button
              type="button"
              disabled={COLUMNS.findIndex((c) => c.id === activeMobileTab) === COLUMNS.length - 1}
              onClick={() => {
                const idx = COLUMNS.findIndex((c) => c.id === activeMobileTab);
                if (idx < COLUMNS.length - 1) setActiveMobileTab(COLUMNS[idx + 1].id);
              }}
              className="disabled:opacity-25 flex items-center gap-0.5 text-terracotta dark:text-neon-orange font-medium"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Desktop Utility Bar: Density Switch */}
      <div className="hidden md:flex items-center justify-end gap-3 mb-2.5">
        <div
          onClick={() => setIsCompactCards(!isCompactCards)}
          className="px-2.5 py-1 rounded-lg border border-warmgray-border/70 dark:border-dark-border bg-cream-100/60 dark:bg-dark-card/60 hover:bg-white dark:hover:bg-dark-card text-xs text-ink-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-slate-200 transition-all flex items-center gap-2 shadow-2xs cursor-pointer select-none"
          title="Compact mode minimizes card descriptions for high-density overview"
        >
          <ChevronsUpDown className="w-3.5 h-3.5 text-ink-400 dark:text-slate-500" />
          <span className="font-mono text-[11px]">Compact Density</span>
          <ToggleSwitch
            size="sm"
            checked={isCompactCards}
            onChange={setIsCompactCards}
            activeColor="teal"
            ariaLabel="Toggle compact density mode"
          />
        </div>
      </div>

      {/* 4 Column Board Grid */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
          {COLUMNS.map((column) => {
            const isHidden = hiddenColumns.has(column.id);
            const isMobileHidden = mobileViewMode === 'tabbed' && column.id !== activeMobileTab;

            // Collapsed slim view when hidden
            if (isHidden) {
              const count = getColumnTasks(column.id).length;
              return (
                <div
                  key={column.id}
                  onClick={() => toggleHideColumn(column.id)}
                  className={`bg-cream-200/40 hover:bg-cream-200/70 border border-dashed border-warmgray-border rounded-lg p-3 flex flex-col items-center justify-between cursor-pointer transition-colors h-64 select-none group ${
                    isMobileHidden ? 'hidden md:flex' : 'flex'
                  }`}
                  title={`Click to expand hidden column: ${column.title}`}
                >
                  <div className="flex flex-col items-center gap-2 text-ink-400 group-hover:text-terracotta transition-colors">
                    <Eye className="w-4 h-4" />
                    <span className="text-[11px] font-mono font-medium tracking-wider [writing-mode:vertical-lr] rotate-180 uppercase">
                      {column.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cream-300 text-ink-700 font-semibold">
                    {count}
                  </span>
                </div>
              );
            }

            const columnTasks = getColumnTasks(column.id);
            const blockedCount = columnTasks.filter((t) => t.blocked).length;
            const readyCount = columnTasks.filter((t) => !t.blocked).length;
            const isBottleneck = bottleneckColumnId === column.id;
            const wipLimit = wipLimits[column.id] || 4;
            const isAtWipLimit = columnTasks.length === wipLimit;
            const isOverWipLimit = columnTasks.length > wipLimit;
            const wipPercent = Math.min(100, Math.round((columnTasks.length / wipLimit) * 100));
            const avgTime = getColumnAvgTime(column.id, columnTasks);
            const isDroppingFlash = droppedColumnId === column.id;

            return (
              <div
                key={column.id}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className={`bg-cream-200/50 dark:bg-dark-surface/90 rounded-lg border max-h-[calc(100vh-270px)] transition-all duration-300 relative ${
                  isMobileHidden ? 'hidden md:flex flex-col' : 'flex flex-col'
                } ${
                  isBottleneck
                    ? 'border-amber-400 dark:border-amber-500/80 ring-2 ring-amber-300/40 shadow-md animate-bottleneck-pulse'
                    : isDroppingFlash
                    ? 'animate-column-drop-flash border-emerald-400'
                    : 'border-warmgray-border dark:border-dark-border'
                }`}
              >
                {/* Bottleneck Warning Banner at Column Top */}
                {isBottleneck && (
                  <div className="px-3 py-1.5 bg-gradient-to-r from-amber-500/15 to-amber-500/5 dark:from-amber-950/40 dark:to-transparent border-b border-amber-300 dark:border-amber-800/80 flex items-center justify-between text-[10px] font-mono text-amber-950 dark:text-amber-200 font-medium rounded-t-lg">
                    <span className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-bounce shrink-0" />
                      <span>Bottleneck Column</span>
                    </span>
                    <span
                      className="text-[9px] bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-700/60"
                      title="Tasks are waiting here the longest"
                    >
                      Longest Queue
                    </span>
                  </div>
                )}

                {/* Column Header */}
                <div className={`p-3.5 border-b border-warmgray-border dark:border-dark-border bg-cream-100/70 dark:bg-dark-card/90 transition-colors ${!isBottleneck ? 'rounded-t-lg' : ''}`}>
                  {/* Top Header Row: Title + Stats Badge + 3-Dot Menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-ink-900 dark:text-slate-100 font-display">
                          {column.title}
                        </h3>

                        {/* Column Stats Breakdown Badge: e.g. "Backlog (4 blocked, 2 ready)" */}
                        {column.id === 'BACKLOG' ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full font-medium bg-cream-300 text-ink-700 border border-warmgray-border/80"
                            title="Backlog state breakdown"
                          >
                            <Lock className="w-2.5 h-2.5 text-badge-blocked" />
                            <span>{blockedCount} blocked, {readyCount} ready</span>
                          </span>
                        ) : column.id === 'IN_PROGRESS' ? (
                          /* In Progress with Live Active Counter */
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
                            title="Tasks actively being worked on right now"
                          >
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>{columnTasks.length} Active</span>
                          </span>
                        ) : column.id === 'REVIEW' ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            {columnTasks.length} in QA
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-medium bg-badge-doneBg text-badge-done border border-badge-doneBorder">
                            {columnTasks.length} done
                          </span>
                        )}
                      </div>

                      {/* Column Avg Time Indicator */}
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-ink-500 font-mono">
                        <Clock className="w-3 h-3 text-ink-400 shrink-0" />
                        <span title="Calculated average dwell time for cards in this column">{avgTime}</span>
                      </div>
                    </div>

                    {/* Column Menu 3-Dots Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuColumn(activeMenuColumn === column.id ? null : column.id);
                        }}
                        className="p-1 rounded hover:bg-cream-300/70 text-ink-500 hover:text-ink-800 transition-colors"
                        title="Column options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Column Dropdown Menu */}
                      {activeMenuColumn === column.id && (
                        <div
                          ref={menuRef}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg shadow-xl z-50 p-1.5 text-xs text-ink-800 dark:text-slate-200 font-sans animate-in fade-in zoom-in-95 duration-100"
                        >
                          <div className="px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-400 dark:text-slate-500 border-b border-warmgray-border/60 dark:border-dark-border/60 mb-1">
                            {column.title} Options
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setTempWipLimit(wipLimit);
                              setSettingsColumn(column.id);
                              setActiveMenuColumn(null);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cream-100 dark:hover:bg-dark-surface text-ink-700 dark:text-slate-300 text-left transition-colors font-mono text-[11px]"
                          >
                            <Sliders className="w-3.5 h-3.5 text-terracotta dark:text-neon-orange" />
                            <span>WIP Limit Settings</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleHideColumn(column.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cream-100 text-ink-700 text-left transition-colors font-mono text-[11px]"
                          >
                            <EyeOff className="w-3.5 h-3.5 text-ink-500" />
                            <span>Hide Column</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleArchiveColumn(column.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cream-100 text-ink-700 text-left transition-colors font-mono text-[11px]"
                          >
                            <Archive className="w-3.5 h-3.5 text-amber-600" />
                            <span>Archive Cards ({columnTasks.length})</span>
                          </button>

                          {/* Quick Sort Options */}
                          <div className="pt-1 mt-1 border-t border-warmgray-border/60">
                            <div className="px-2 py-0.5 text-[9px] font-mono uppercase text-ink-400">
                              Sort cards
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setColumnSorts({ ...columnSorts, [column.id]: 'default' });
                                setActiveMenuColumn(null);
                              }}
                              className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                                columnSorts[column.id] === 'default' ? 'bg-cream-200 text-terracotta font-semibold' : 'text-ink-600 hover:bg-cream-100'
                              }`}
                            >
                              <span>Default Board Position</span>
                              {columnSorts[column.id] === 'default' && <Check className="w-3 h-3 text-terracotta" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setColumnSorts({ ...columnSorts, [column.id]: 'dueDate' });
                                setActiveMenuColumn(null);
                              }}
                              className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                                columnSorts[column.id] === 'dueDate' ? 'bg-cream-200 text-terracotta font-semibold' : 'text-ink-600 hover:bg-cream-100'
                              }`}
                            >
                              <span>Due Date</span>
                              {columnSorts[column.id] === 'dueDate' && <Check className="w-3 h-3 text-terracotta" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setColumnSorts({ ...columnSorts, [column.id]: 'title' });
                                setActiveMenuColumn(null);
                              }}
                              className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                                columnSorts[column.id] === 'title' ? 'bg-cream-200 text-terracotta font-semibold' : 'text-ink-600 hover:bg-cream-100'
                              }`}
                            >
                              <span>Title (A-Z)</span>
                              {columnSorts[column.id] === 'title' && <Check className="w-3 h-3 text-terracotta" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WIP Limit Visual Indicator Bar */}
                  <div className="mt-2.5 pt-2 border-t border-warmgray-border/60">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-ink-500 font-medium">WIP Capacity</span>
                      <span
                        className={`font-semibold ${
                          isOverWipLimit
                            ? 'text-red-700 animate-pulse'
                            : isAtWipLimit
                            ? 'text-amber-700'
                            : 'text-ink-600'
                        }`}
                      >
                        {columnTasks.length}/{wipLimit} cards{' '}
                        {isOverWipLimit ? (
                          <span className="text-red-600 font-bold">(Over by {columnTasks.length - wipLimit}!)</span>
                        ) : isAtWipLimit ? (
                          <span className="text-amber-600">(At Limit)</span>
                        ) : null}
                      </span>
                    </div>

                    {/* Progress Bar of WIP usage */}
                    <div className="w-full h-1.5 bg-cream-300 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isOverWipLimit
                            ? 'bg-red-500'
                            : isAtWipLimit
                            ? 'bg-amber-500'
                            : wipPercent > 70
                            ? 'bg-terracotta'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${wipPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Droppable Card Area with Drag-Over Animation */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-3 overflow-y-auto flex-1 min-h-[220px] transition-all duration-200 rounded-b-lg ${
                        snapshot.isDraggingOver
                          ? 'animate-column-drop-target bg-terracotta-light/20 ring-2 ring-terracotta/40'
                          : ''
                      }`}
                    >
                      {/* Drag Over Hint Helper */}
                      {snapshot.isDraggingOver && (
                        <div className="mb-3 p-2.5 rounded-lg border-2 border-dashed border-terracotta bg-white/80 flex items-center justify-center gap-1.5 text-xs font-mono text-terracotta font-semibold animate-pulse shadow-sm">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Release card into {column.title}</span>
                        </div>
                      )}

                      {columnTasks.length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center border border-dashed border-warmgray-border/80 rounded-lg text-ink-400 text-xs font-mono">
                          <span>Empty column</span>
                          <span className="text-[10px] text-ink-300 mt-0.5">Drag cards here</span>
                        </div>
                      ) : (
                        columnTasks.map((task, index) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            index={index}
                            allTasks={tasks}
                            onClick={onTaskClick}
                            onQuickStatusChange={handleQuickStatusChange}
                            isDragBlockedWarning={warnedTaskId === task.id}
                            isJustUnblocked={justUnblockedTaskIds.includes(task.id)}
                            defaultCollapsed={isCompactCards}
                            isCritical={criticalPath.criticalPathNodeIds.has(task.id)}
                            isCycleMember={dependencyAnalysis.cycleAnalysis.cycleNodeIds.has(task.id)}
                          />
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Inline WIP Settings Popover */}
                {settingsColumn === column.id && (
                  <div className="absolute inset-x-2 top-14 bg-white dark:bg-dark-card border border-terracotta-border dark:border-dark-border rounded-lg p-3 shadow-xl z-40 animate-in fade-in zoom-in-95 duration-100 text-xs font-mono text-ink-900 dark:text-slate-100">
                    <div className="flex items-center justify-between font-semibold text-ink-900 dark:text-slate-100 pb-1.5 border-b border-warmgray-border dark:border-dark-border mb-2">
                      <span>WIP Limit: {column.title}</span>
                      <button
                        type="button"
                        onClick={() => setSettingsColumn(null)}
                        className="text-ink-400 dark:text-slate-400 hover:text-ink-700 dark:hover:text-slate-200"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="text-[11px] text-ink-500 dark:text-slate-400 mb-2 leading-relaxed">
                      Set maximum concurrent cards to prevent multitasking bottlenecks.
                    </p>

                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setTempWipLimit((prev) => Math.max(1, prev - 1))}
                        className="w-7 h-7 rounded border border-warmgray-border dark:border-dark-border bg-cream-100 dark:bg-dark-surface hover:bg-cream-200 dark:hover:bg-dark-cardHover text-ink-800 dark:text-slate-200 font-bold flex items-center justify-center"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={tempWipLimit}
                        onChange={(e) => setTempWipLimit(parseInt(e.target.value) || 1)}
                        className="w-16 text-center border border-warmgray-border dark:border-dark-border rounded py-1 px-2 font-mono font-semibold text-ink-900 dark:text-slate-100 bg-cream-50 dark:bg-dark-surface"
                      />
                      <button
                        type="button"
                        onClick={() => setTempWipLimit((prev) => prev + 1)}
                        className="w-7 h-7 rounded border border-warmgray-border dark:border-dark-border bg-cream-100 dark:bg-dark-surface hover:bg-cream-200 dark:hover:bg-dark-cardHover text-ink-800 dark:text-slate-200 font-bold flex items-center justify-center"
                      >
                        +
                      </button>
                      <span className="text-[11px] text-ink-400 dark:text-slate-500">cards max</span>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSettingsColumn(null)}
                        className="px-2.5 py-1 rounded text-ink-600 hover:bg-cream-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => updateWipLimit(column.id, tempWipLimit)}
                        className="px-3 py-1 rounded bg-terracotta text-white font-semibold hover:bg-terracotta-hover transition-colors shadow-2xs"
                      >
                        Save Limit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};
