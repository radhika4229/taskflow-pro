import React, { useState, useEffect, useMemo } from 'react';
import { Task, TaskStatus } from '../types';
import { Draggable } from '@hello-pangea/dnd';
import {
  Calendar,
  GitFork,
  CheckCircle2,
  Clock,
  X,
  ChevronRight,
  AlertOctagon,
  Timer,
  HelpCircle,
  Hourglass,
  ArrowUpRight,
  ShieldAlert,
  ChevronDown,
  ExternalLink,
  Flame,
  AlertTriangle,
  Zap,
  RotateCcw,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  index: number;
  allTasks: Task[];
  onClick: (task: Task) => void;
  onQuickStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  isDragBlockedWarning?: boolean;
  isJustUnblocked?: boolean;
  defaultCollapsed?: boolean;
  isCritical?: boolean;
  isCycleMember?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  index,
  allTasks,
  onClick,
  onQuickStatusChange,
  isDragBlockedWarning = false,
  isJustUnblocked = false,
  defaultCollapsed,
  isCritical = false,
  isCycleMember = false,
}) => {
  const [showTreeTooltip, setShowTreeTooltip] = useState(false);
  const [showWhyBlockedTooltip, setShowWhyBlockedTooltip] = useState(false);

  // Collapse/Expand state: On mobile (<768px), default to collapsed; on desktop default to expanded
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof defaultCollapsed === 'boolean') return !defaultCollapsed;
    return typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
  });

  useEffect(() => {
    if (typeof defaultCollapsed === 'boolean') {
      setIsExpanded(!defaultCollapsed);
    }
  }, [defaultCollapsed]);

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const startFormatted = formatDate(task.startDate);
  const endFormatted = formatDate(task.endDate);

  // Compute status pill
  const getStatusPill = () => {
    if (task.blocked) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase bg-badge-blockedBg dark:bg-red-950/70 text-badge-blocked dark:text-red-300 border border-badge-blockedBorder dark:border-red-800/80 animate-pulse">
          Blocked
        </span>
      );
    }
    if (task.status === 'DONE') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium tracking-wide uppercase bg-badge-doneBg dark:bg-dark-surface text-badge-done dark:text-slate-400 border border-badge-doneBorder dark:border-dark-border">
          Done
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase bg-badge-readyBg dark:bg-emerald-950/70 text-badge-ready dark:text-emerald-300 border border-badge-readyBorder dark:border-emerald-700/80">
        Ready
      </span>
    );
  };

  // Find prerequisite tasks
  const prerequisiteTasks = (task.prerequisiteIds || [])
    .map((pId) => allTasks.find((t) => t.id === pId))
    .filter(Boolean) as Task[];

  // Find direct dependent tasks (tasks waiting on this task)
  const dependentTasks = allTasks.filter((t) =>
    t.prerequisiteIds?.includes(task.id)
  );

  const hasDependencies =
    (task.prerequisiteIds && task.prerequisiteIds.length > 0) ||
    dependentTasks.length > 0;

  // Dependency Score & Analysis
  const isOrphaned = dependentTasks.length === 0;
  const isCriticalBlocker = dependentTasks.length >= 2;

  const dependencyScore = useMemo(() => {
    const direct = dependentTasks.length;
    // Transitive reach
    const reachable = new Set<string>();
    const queue = [...dependentTasks.map((t) => t.id)];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (!reachable.has(curr)) {
        reachable.add(curr);
        allTasks
          .filter((t) => (t.prerequisiteIds || []).includes(curr))
          .forEach((t) => {
            if (!reachable.has(t.id)) queue.push(t.id);
          });
      }
    }
    const transitive = reachable.size;
    const directPts = Math.min(30, direct * 12);
    const transPts = Math.min(40, transitive * 10);
    const critBonus = isCritical ? 20 : 0;
    const pendingBonus = dependentTasks.some((t) => t.blocked || t.status !== 'DONE') ? 10 : 0;
    const score = Math.max(5, Math.min(100, directPts + transPts + critBonus + pendingBonus));
    const isKeystone = direct >= 2 || score >= 70;

    return {
      score,
      direct,
      transitive,
      isKeystone,
      isOrphaned: direct === 0,
      tier: isKeystone ? 'Keystone' : score >= 40 ? 'High' : direct === 0 ? 'Leaf' : 'Moderate',
    };
  }, [dependentTasks, allTasks, isCritical]);

  // Blocker completion metrics
  const totalPrereqs = prerequisiteTasks.length;
  const completedPrereqs = prerequisiteTasks.filter((t) => t.status === 'DONE').length;
  const pendingPrereqs = prerequisiteTasks.filter((t) => t.status !== 'DONE');
  const percentComplete =
    totalPrereqs > 0 ? Math.round((completedPrereqs / totalPrereqs) * 100) : 100;

  // Calculate unblock countdown timer estimate
  const unblockEstimate = (() => {
    if (pendingPrereqs.length === 0) return null;
    let latestDate: Date | null = null;
    for (const b of pendingPrereqs) {
      if (b.endDate) {
        const d = new Date(b.endDate);
        if (!latestDate || d > latestDate) latestDate = d;
      }
    }

    if (!latestDate) {
      return { days: 2, formattedDate: 'Oct 1' };
    }

    const now = new Date();
    const targetDate: Date = latestDate;
    const diffDays = Math.max(1, Math.ceil((targetDate.getTime() - now.getTime()) / 86400000));
    const formattedDate = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { days: diffDays, formattedDate };
  })();

  // Helper to compute progress and days remaining of a blocker task
  const getBlockerDetails = (blocker: Task) => {
    let progressLabel = 'Not started (0%)';
    if (blocker.status === 'IN_PROGRESS') progressLabel = 'In Progress (~60%)';
    else if (blocker.status === 'REVIEW') progressLabel = 'In Review (~90%)';
    else if (blocker.status === 'DONE') progressLabel = 'Done (100%)';

    let daysRemaining = '~2d remaining';
    if (blocker.endDate) {
      try {
        const target = new Date(blocker.endDate).getTime();
        const now = new Date().getTime();
        const diff = Math.ceil((target - now) / 86400000);
        if (diff <= 0) daysRemaining = 'Due today';
        else daysRemaining = `~${diff}d remaining`;
      } catch {
        daysRemaining = '~2d remaining';
      }
    }
    return { progressLabel, daysRemaining };
  };

  // Render ASCII blocks for blocker completion: e.g. [████░░░░░░ 40%]
  const getAsciiBlocks = (percent: number) => {
    const total = 10;
    const filled = Math.min(10, Math.max(0, Math.round((percent / 100) * total)));
    const empty = total - filled;
    return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${percent}%`;
  };

  // High risk detection: task is blocking multiple downstream tasks while unfinished
  const isHighRiskBlocker = dependentTasks.length >= 2 && task.status !== 'DONE';

  // Last moved team member simulation
  const MEMBERS = [
    { initials: 'RP', name: 'Radhika P.', bg: 'bg-[#FDF3EE]', text: 'text-[#D97748]', border: 'border-[#F4D3C2]' },
    { initials: 'AK', name: 'Alex K.', bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]', border: 'border-[#86EFAC]' },
    { initials: 'SL', name: 'Sarah L.', bg: 'bg-[#FEFCE8]', text: 'text-[#CA8A04]', border: 'border-[#FDE047]' },
    { initials: 'JD', name: 'Jordan D.', bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]' },
    { initials: 'MT', name: 'Marcus T.', bg: 'bg-[#FAF5FF]', text: 'text-[#9333EA]', border: 'border-[#E9D5FF]' },
  ];
  const memberIndex = Math.abs(
    task.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % MEMBERS.length;
  const lastMover = MEMBERS[memberIndex];

  // Time in column indicator calculation
  const getTimeInColumn = () => {
    const baseDays = ((task.boardPosition || 0) % 4) + 1;
    if (task.status === 'DONE') return 'Archived in Done';
    const colName =
      task.status === 'BACKLOG'
        ? 'Backlog'
        : task.status === 'IN_PROGRESS'
        ? 'In Progress'
        : 'Review';
    return `${baseDays}d in ${colName}`;
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={(e) => {
            if ((e.target as HTMLElement)?.closest('button, a, input')) {
              return;
            }
            if (!isExpanded) {
              setIsExpanded(true);
            } else {
              onClick(task);
            }
          }}
          className={`relative group rounded-lg border p-4 mb-3 cursor-pointer select-none transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-card hover:scale-[1.01] ${
            snapshot.isDragging
              ? 'shadow-2xl border-terracotta ring-2 ring-terracotta/50 scale-105 rotate-2 -translate-y-2 z-50 animate-drag-ripple bg-white dark:bg-dark-cardHover'
              : isDragBlockedWarning
              ? 'border-badge-blocked ring-2 ring-badge-blockedBg animate-pulse bg-white dark:bg-dark-card'
              : isJustUnblocked
              ? 'animate-unblock-flash border-emerald-500 ring-2 ring-emerald-400/60 shadow-lg bg-white dark:bg-dark-card'
              : isCritical && task.blocked
              ? 'border-red-500 bg-red-50/25 dark:bg-[#1D131A] ring-2 ring-red-400/70 animate-pulse-red shadow-md neon-glow-red'
              : isCritical && task.status !== 'DONE'
              ? 'border-amber-400 dark:border-amber-500/80 bg-amber-50/25 dark:bg-[#1D1A14] ring-1 ring-amber-400/50 shadow-md animate-critical-glow'
              : task.blocked
              ? 'border-red-400 bg-red-50/15 hover:border-red-500 dark:bg-[#1C1217] dark:border-red-500 neon-glow-red animate-pulse-red'
              : task.status !== 'DONE'
              ? 'bg-white dark:bg-[#0E1A18] border-warmgray-border dark:border-emerald-500/70 neon-glow-green hover:border-ink-400'
              : 'bg-white dark:bg-[#141824] border-warmgray-border dark:border-slate-800 hover:border-ink-400 dark:hover:border-slate-600 text-ink-900 dark:text-slate-100'
          }`}
        >
          {/* Newly Unblocked Celebration Pill */}
          {isJustUnblocked && (
            <div className="mb-2 px-2 py-1 rounded bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] font-mono font-semibold flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-1">
                <span>⚡</span>
                <span>Blockers Cleared • Ready to Start!</span>
              </span>
              <span className="text-[9px] bg-emerald-200/90 text-emerald-900 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                Ready
              </span>
            </div>
          )}
          {/* Quick Actions Hover Strip (Top Right) */}
          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center gap-1 z-20 bg-white/95 backdrop-blur-xs p-1 rounded-md border border-warmgray-border shadow-sm">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick(task);
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono text-ink-700 hover:text-ink-900 hover:bg-cream-200 transition-colors"
            >
              Details
            </button>

            {/* Dynamic Status Action */}
            {task.status === 'BACKLOG' && (
              <button
                type="button"
                disabled={task.blocked}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!task.blocked && onQuickStatusChange) {
                    onQuickStatusChange(task.id, 'IN_PROGRESS');
                  }
                }}
                title={task.blocked ? 'Cannot start: task is blocked by prerequisites' : 'Move to In Progress'}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  task.blocked
                    ? 'text-ink-400 dark:text-slate-500 bg-cream-200/50 dark:bg-dark-surface/50 cursor-not-allowed'
                    : 'text-terracotta dark:text-neon-orange hover:bg-terracotta-light dark:hover:bg-orange-950/40 border border-terracotta-border dark:border-orange-800/60 font-semibold'
                }`}
              >
                {task.blocked ? 'Blocked' : 'Start →'}
              </button>
            )}

            {task.status === 'IN_PROGRESS' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onQuickStatusChange) onQuickStatusChange(task.id, 'REVIEW');
                }}
                className="px-2 py-0.5 rounded text-[10px] font-mono text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 font-semibold transition-colors"
              >
                Review →
              </button>
            )}

            {task.status === 'REVIEW' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onQuickStatusChange) onQuickStatusChange(task.id, 'DONE');
                }}
                className="px-2 py-0.5 rounded text-[10px] font-mono text-badge-ready dark:text-emerald-400 hover:bg-badge-readyBg dark:hover:bg-emerald-950/40 border border-badge-readyBorder dark:border-emerald-700/60 font-semibold transition-colors"
              >
                ✓ Done
              </button>
            )}

            {task.status === 'DONE' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onQuickStatusChange) onQuickStatusChange(task.id, 'IN_PROGRESS');
                }}
                title="Rollback to In Progress (re-blocks downstream dependents)"
                className="px-2 py-0.5 rounded text-[10px] font-mono text-ink-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-slate-200 hover:bg-cream-200 dark:hover:bg-dark-card border border-warmgray-border dark:border-dark-border transition-colors"
              >
                ↺ Rollback
              </button>
            )}
          </div>

          {/* Card Top: Badges & Chain Indicator */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-ink-400">
                #{task.id.slice(0, 6)}
              </span>

              {/* Circular Reference Warning Pill */}
              {isCycleMember && (
                <div
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-600 text-white border border-red-700 shadow-xs animate-pulse"
                  title="Circular Reference Loop: This task is locked in a cyclic dependency!"
                >
                  <RotateCcw className="w-3 h-3 animate-spin" />
                  <span>Cycle Loop</span>
                </div>
              )}

              {/* Critical Blocker / Keystone Badge */}
              {isCriticalBlocker && task.status !== 'DONE' && (
                <div
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-800/60 shadow-2xs"
                  title={`Critical Blocker: Unblocks ${dependentTasks.length} downstream activities simultaneously`}
                >
                  <Zap className="w-3 h-3 text-purple-600 dark:text-purple-400 fill-current" />
                  <span>Unblocks {dependentTasks.length}</span>
                </div>
              )}



              {/* Critical Path Badge with Tooltip */}
              {isCritical && (
                <div
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight shadow-2xs ${
                    task.blocked
                      ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/60 animate-pulse'
                      : 'bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                  }`}
                  title="This task is on critical path - any delay affects deadline"
                >
                  <Flame className="w-3 h-3 text-terracotta dark:text-neon-orange shrink-0 fill-current" />
                  <span>Critical Path</span>
                </div>
              )}

              {/* Chain icon on cards with dependencies */}
              {hasDependencies && (
                <button
                  type="button"
                  title="Hover or click to view full dependency tree"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTreeTooltip(!showTreeTooltip);
                  }}
                  onMouseEnter={() => setShowTreeTooltip(true)}
                  onMouseLeave={() => setShowTreeTooltip(false)}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono bg-cream-200/90 hover:bg-terracotta-light text-ink-700 hover:text-terracotta border border-warmgray-border transition-colors"
                >
                  <span className="text-xs animate-chain-link">🔗</span>
                  <span className="text-[10px] font-semibold">
                    {task.prerequisiteIds?.length || 0}
                  </span>
                </button>
              )}

              {/* High Risk Bottleneck Indicator */}
              {isHighRiskBlocker && (
                <span
                  title={`High Risk Bottleneck: This task is actively blocking ${dependentTasks.length} downstream tasks!`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                >
                  <AlertOctagon className="w-3 h-3 text-amber-700 shrink-0" />
                  <span>Blocks {dependentTasks.length}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {getStatusPill()}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-1 rounded hover:bg-cream-200 dark:hover:bg-dark-cardHover text-ink-400 dark:text-slate-400 hover:text-ink-700 dark:hover:text-slate-200 transition-colors"
                title={isExpanded ? 'Collapse card (show title + status only)' : 'Expand card (show full details)'}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Critical Path Warning: Project completion blocked callout */}
          {isCritical && task.blocked && (
            <div
              className="mb-2 px-2.5 py-1 rounded bg-red-100/90 dark:bg-red-950/70 border border-red-300 dark:border-red-800/70 text-red-900 dark:text-red-200 text-[10px] font-mono flex items-center justify-between gap-1 shadow-2xs animate-pulse"
              title="This task is on critical path - any delay affects deadline"
            >
              <div className="flex items-center gap-1 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                <span className="font-bold truncate">Critical Blocker: Halts Launch</span>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-red-700 dark:text-red-300 shrink-0">
                0d float
              </span>
            </div>
          )}

          {/* Card Title */}
          <h4 className="text-sm font-medium text-ink-900 dark:text-slate-100 leading-snug group-hover:text-terracotta dark:group-hover:text-neon-orange transition-colors">
            {task.title}
          </h4>

          {/* Collapsed Compact Quick Info Bar */}
          {!isExpanded && (
            <div className="mt-2 pt-1.5 border-t border-warmgray-border/40 dark:border-dark-border/40 flex items-center justify-between text-[10px] font-mono text-ink-400 dark:text-slate-500">
              <span className="truncate flex items-center gap-1">
                <span className="text-terracotta dark:text-neon-orange font-semibold">Tap to expand</span>
                {task.description && <span>• Details</span>}
              </span>
              <span>
                {prerequisiteTasks.length > 0
                  ? `${completedPrereqs}/${totalPrereqs} prereqs`
                  : 'Root Task'}
              </span>
            </div>
          )}

          {/* Collapsible Details Body */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isExpanded
                ? 'max-h-[950px] opacity-100'
                : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            {/* Card Description preview */}
            {task.description && (
              <p className="mt-2 text-xs text-ink-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}

          {/* Actionable Blocked Hub with Live Blocker Inspection & Countdown */}
          {task.blocked && (
            <div className="mt-2.5 p-3 rounded-lg bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-950 dark:text-red-200 shadow-2xs space-y-2">
              {/* Header: Animated Chain + Countdown Timer + Why Blocked? */}
              <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-red-200/70">
                <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wide text-red-800">
                  <span className="animate-chain-link text-xs">🔗</span>
                  <span>Blocked</span>
                  {/* Countdown Timer */}
                  {unblockEstimate && (
                    <span
                      className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-red-100/90 text-red-900 border border-red-300"
                      title="Estimated unblock schedule"
                    >
                      <Hourglass className="w-2.5 h-2.5 text-red-700 animate-pulse" />
                      <span>Unblocks in ~{unblockEstimate.days}d ({unblockEstimate.formattedDate})</span>
                    </span>
                  )}
                </div>

                {/* Info Tooltip Trigger: Why is this blocked? */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowWhyBlockedTooltip(!showWhyBlockedTooltip);
                    }}
                    onMouseEnter={() => setShowWhyBlockedTooltip(true)}
                    onMouseLeave={() => setShowWhyBlockedTooltip(false)}
                    className="inline-flex items-center gap-1 text-[10px] text-red-700 hover:text-red-900 bg-white/80 hover:bg-white px-1.5 py-0.5 rounded border border-red-300 transition-colors shadow-2xs font-mono font-medium"
                    title="Why is this blocked?"
                  >
                    <HelpCircle className="w-3 h-3 text-red-600" />
                    <span>Why blocked?</span>
                  </button>

                  {/* Why Blocked Popover Tooltip */}
                  {showWhyBlockedTooltip && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1.5 z-40 w-64 bg-white border border-red-200 rounded-lg p-3 shadow-xl text-ink-900 text-xs animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-red-800 mb-1 text-[11px] uppercase font-mono">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                        <span>DAG Block Rule</span>
                      </div>
                      <p className="text-[11px] text-ink-600 leading-relaxed">
                        In TaskFlow Pro, tasks cannot start until <strong>all prerequisites</strong> reach <span className="font-semibold text-badge-ready">Done</span>.
                      </p>
                      <div className="mt-2 pt-1.5 border-t border-warmgray-border text-[10px] font-mono text-ink-500">
                        Pending blockers: {pendingPrereqs.map((p) => p.title).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actionable Blockers List: Title, Progress, Days Remaining, and [View Blocker] */}
              <div className="space-y-1.5">
                {pendingPrereqs.slice(0, 2).map((blocker) => {
                  const { progressLabel, daysRemaining } = getBlockerDetails(blocker);
                  return (
                    <div
                      key={blocker.id}
                      className="bg-white/95 dark:bg-dark-card rounded border border-red-200/90 dark:border-red-900/40 p-2 flex items-center justify-between gap-2 shadow-2xs hover:border-red-400 dark:hover:border-red-500 transition-colors group/blocker"
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onClick(blocker);
                          }}
                          className="font-medium text-xs text-ink-900 dark:text-slate-100 truncate hover:text-red-700 dark:hover:text-red-400 underline-offset-2 hover:underline cursor-pointer flex items-center gap-1"
                          title="Click to jump and view this prerequisite blocker"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                          <span className="truncate">{blocker.title}</span>
                          <ArrowUpRight className="w-3 h-3 text-red-600 opacity-60 group-hover/blocker:opacity-100 shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-ink-500 dark:text-slate-400">
                          <span className="text-amber-700 dark:text-amber-400 font-medium">{progressLabel}</span>
                          <span>•</span>
                          <span className="text-red-800 dark:text-red-300">{daysRemaining}</span>
                        </div>
                      </div>

                      {/* [View Blocker] Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClick(blocker);
                        }}
                        className="px-2 py-1 bg-red-100/80 hover:bg-red-200 text-red-900 rounded text-[10px] font-mono font-semibold transition-colors shrink-0 flex items-center gap-1 shadow-2xs border border-red-300"
                        title="Focus and inspect this blocker task"
                      >
                        <span>View</span>
                        <ChevronRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}

                {pendingPrereqs.length > 2 && (
                  <div className="text-[10px] text-red-800 font-mono text-center">
                    +{pendingPrereqs.length - 2} more blockers pending
                  </div>
                )}
              </div>

              {/* Progress bar of blocker completion */}
              <div className="pt-2 border-t border-red-200/70">
                <div className="flex items-center justify-between text-[11px] mb-1 font-mono text-red-900">
                  <span className="truncate max-w-[170px]" title={`Waiting for: ${pendingPrereqs[0]?.title || 'Prerequisites'}`}>
                    Waiting for: {pendingPrereqs[0]?.title || 'Prerequisites'}
                  </span>
                  <span className="font-semibold shrink-0 text-[10px]">
                    [{getAsciiBlocks(percentComplete)} {percentComplete}%]
                  </span>
                </div>
                <div className="w-full h-1.5 bg-red-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Progress bar of blocker completion */}
          {totalPrereqs > 0 && !task.blocked && (
            <div className="mt-2.5 bg-cream-100/90 border border-warmgray-border/80 rounded-lg p-2.5 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] mb-1.5 gap-1">
                <span className="text-badge-ready font-semibold">
                  All prerequisites cleared (100%)
                </span>
                <span className="text-[10px] text-ink-500 font-mono shrink-0 font-semibold">
                  [{getAsciiBlocks(100)}]
                </span>
              </div>

              {/* Animated Progress Meter */}
              <div className="w-full h-1.5 bg-cream-300 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500 rounded-full bg-badge-ready"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="mt-1 flex items-center justify-between text-[10px] text-ink-400 font-mono">
                <span>Blockers cleared</span>
                <span>{completedPrereqs}/{totalPrereqs} completed</span>
              </div>
            </div>
          )}

          {/* Card Footer: Metadata, Time in Column, Dates & Mover Avatar */}
          <div className="mt-3 pt-2.5 border-t border-warmgray-border/60 flex items-center justify-between text-[11px] text-ink-500 font-mono">
            {/* Left: Prerequisite Count & Dates */}
            <div className="flex items-center gap-2">
              {task.prerequisiteIds && task.prerequisiteIds.length > 0 ? (
                <span
                  onMouseEnter={() => setShowTreeTooltip(true)}
                  onMouseLeave={() => setShowTreeTooltip(false)}
                  className="inline-flex items-center gap-1 text-ink-600 bg-cream-200/60 hover:bg-cream-300/80 px-1.5 py-0.5 rounded transition-colors"
                  title="Hover to inspect dependency tree"
                >
                  <GitFork className="w-3 h-3 text-ink-400" />
                  <span>
                    {task.prerequisiteIds.length}{' '}
                    {task.prerequisiteIds.length === 1 ? 'prereq' : 'prereqs'}
                  </span>
                </span>
              ) : (
                <span className="text-ink-400 text-[10px]">No prereqs</span>
              )}

              {(startFormatted || endFormatted) && (
                <span className="hidden sm:inline-flex items-center gap-1 text-ink-500">
                  <Calendar className="w-3 h-3 text-ink-400" />
                  <span>
                    {startFormatted && endFormatted
                      ? `${startFormatted} – ${endFormatted}`
                      : startFormatted || endFormatted}
                  </span>
                </span>
              )}
            </div>

            {/* Right: Time in Column & Last Mover Avatar */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Time in Column */}
              <span
                className="inline-flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-600 transition-colors"
                title="Time elapsed in current board column"
              >
                <Timer className="w-3 h-3 text-ink-400" />
                <span>{getTimeInColumn()}</span>
              </span>

              {/* Last Mover Avatar */}
              <div
                title={`Last moved by ${lastMover.name}`}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold font-sans border uppercase ${lastMover.bg} ${lastMover.text} ${lastMover.border}`}
              >
                {lastMover.initials}
              </div>
            </div>
          </div>

          {/* Dependency Intelligence Info (in Expanded View) */}
            <div className="mt-2 pt-2 border-t border-warmgray-border/50 dark:border-dark-border/60 flex items-center justify-between text-[11px] font-mono">
              <span className="text-ink-500 dark:text-slate-400">
                Impact Score: <span className="font-semibold text-ink-900 dark:text-slate-200">{dependencyScore.score}/100</span>
              </span>
              {isOrphaned && task.status !== 'DONE' ? (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  🍃 Standalone Task
                </span>
              ) : dependentTasks.length > 0 ? (
                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                  Unblocks {dependentTasks.length} task{dependentTasks.length > 1 ? 's' : ''}
                </span>
              ) : null}
            </div>

            {/* Quick Action Link in Expanded State */}
          <div className="mt-2.5 pt-2 border-t border-warmgray-border/50 dark:border-dark-border/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-[10px] text-ink-400 dark:text-slate-500">
              {startFormatted && endFormatted ? `${startFormatted} – ${endFormatted}` : 'No deadline set'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick(task);
              }}
              className="text-terracotta dark:text-neon-orange hover:underline font-semibold flex items-center gap-1 text-[11px]"
            >
              <span>View Full Details</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

          {/* Hover Effect: Full Dependency Tree Tooltip / Popover */}
          {showTreeTooltip && hasDependencies && (
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setShowTreeTooltip(true)}
              onMouseLeave={() => setShowTreeTooltip(false)}
              className="absolute left-2 right-2 top-full mt-2 z-50 bg-cream-50 border border-warmgray-border rounded-xl p-4 shadow-xl text-ink-900 animate-in fade-in zoom-in-95 duration-150"
              style={{ minWidth: '260px' }}
            >
              {/* Tooltip Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-warmgray-border">
                <div className="flex items-center gap-1.5">
                  <span className="animate-chain-link text-xs">🔗</span>
                  <span className="font-display font-semibold text-xs text-ink-900">
                    Dependency Tree
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTreeTooltip(false)}
                  className="text-ink-400 hover:text-ink-700 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Upstream Prerequisites (Blockers) */}
              <div className="mb-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-ink-500 mb-1 flex items-center justify-between">
                  <span>▲ Prerequisites (Must finish first):</span>
                  <span>{completedPrereqs}/{totalPrereqs}</span>
                </div>

                {prerequisiteTasks.length === 0 ? (
                  <div className="text-[11px] text-ink-400 italic pl-2">
                    None (Independent root task)
                  </div>
                ) : (
                  <div className="space-y-1.5 pl-1">
                    {prerequisiteTasks.map((prereq) => {
                      const isDone = prereq.status === 'DONE';
                      return (
                        <div
                          key={prereq.id}
                          className="bg-white border border-warmgray-border/80 rounded px-2 py-1 text-xs flex items-center justify-between gap-1 shadow-2xs"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isDone ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-badge-ready shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-badge-blocked shrink-0 animate-pulse" />
                            )}
                            <span className="truncate font-medium text-ink-800">
                              {prereq.title}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-mono px-1 py-0.2 rounded border uppercase font-semibold shrink-0 ${
                              isDone
                                ? 'bg-badge-readyBg text-badge-ready border-badge-readyBorder'
                                : 'bg-badge-blockedBg text-badge-blocked border-badge-blockedBorder'
                            }`}
                          >
                            {isDone ? 'Done' : 'Blocker'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Current Card Position */}
              <div className="my-2 px-2 py-1 rounded bg-terracotta-light border border-terracotta-border text-[11px] flex items-center gap-1.5 text-terracotta font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-terracotta shrink-0" />
                <span className="truncate">This Task: {task.title}</span>
              </div>

              {/* Downstream Dependents (Tasks unlocked by this) */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-ink-500 mb-1 flex items-center gap-1">
                  <span>▼ Unlocks Downstream ({dependentTasks.length}):</span>
                </div>

                {dependentTasks.length === 0 ? (
                  <div className="text-[11px] text-ink-400 italic pl-2">
                    No downstream tasks depend on this
                  </div>
                ) : (
                  <div className="space-y-1 pl-1">
                    {dependentTasks.map((dep) => (
                      <div
                        key={dep.id}
                        className="bg-white/80 border border-warmgray-border/60 rounded px-2 py-0.5 text-xs text-ink-700 flex items-center gap-1.5"
                      >
                        <ChevronRight className="w-3 h-3 text-terracotta shrink-0" />
                        <span className="truncate">{dep.title}</span>
                        {dep.blocked && (
                          <span className="ml-auto text-[9px] font-mono text-badge-blocked uppercase">
                            Waiting
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};
