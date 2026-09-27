import React, { useState } from 'react';
import { Task } from '../types';
import { CriticalPathResult } from '../utils/criticalPath';
import {
  Flame,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Info,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

interface CriticalPathBannerProps {
  criticalPath: CriticalPathResult;
  onSelectTask: (task: Task) => void;
}

export const CriticalPathBanner: React.FC<CriticalPathBannerProps> = ({
  criticalPath,
  onSelectTask,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const {
    orderedChain,
    shortChainText,
    totalDays,
    isBlocked,
    blockedTasksOnPath,
  } = criticalPath;

  if (orderedChain.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-warmgray-border dark:border-dark-border bg-white/90 dark:bg-dark-surface/90 backdrop-blur-sm shadow-subtle overflow-hidden transition-all duration-300">
      {/* Main Banner Row */}
      <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Flame Icon + Main Badge */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${
              isBlocked
                ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800/60 animate-pulse'
                : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60'
            }`}
          >
            <Flame className="w-5 h-5 fill-current" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {/* Primary Requested Badge */}
              <div
                className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-terracotta/15 dark:from-amber-950/60 dark:via-orange-950/60 dark:to-terracotta/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/70 shadow-2xs group cursor-help"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                title="This task chain is on critical path - any delay affects deadline"
              >
                <Flame className="w-3.5 h-3.5 text-terracotta dark:text-neon-orange" />
                <span className="font-bold">
                  Critical path: {totalDays} days
                </span>
                <span className="text-ink-400 dark:text-slate-400 hidden sm:inline">
                  ({shortChainText})
                </span>

                {/* Floating Tooltip */}
                {showTooltip && (
                  <div className="absolute left-0 top-full mt-1.5 z-30 px-3 py-1.5 bg-ink-900/95 dark:bg-slate-800 text-white text-[11px] font-mono rounded-lg shadow-xl border border-warmgray-border dark:border-dark-border whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-3 h-3 text-terracotta dark:text-neon-orange" />
                      <span>This task chain is on critical path — any delay affects final deadline</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Indicator Pill */}
              {isBlocked ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/60 font-semibold animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Blocked by {blockedTasksOnPath.length} task{blockedTasksOnPath.length > 1 ? 's' : ''}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Unblocked & Flowing</span>
                </span>
              )}
            </div>

            {/* Subtext: Clickable Chain Flow */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs text-ink-600 dark:text-slate-300">
              <span className="text-[11px] font-mono text-ink-400 dark:text-slate-400 shrink-0">
                Sequence:
              </span>
              {orderedChain.map((task, idx) => {
                const isTaskBlocked = task.blocked;
                const isTaskDone = task.status === 'DONE';

                return (
                  <React.Fragment key={task.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      title={`Click to view "${task.title}" — This task is on critical path - any delay affects deadline`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-all shrink-0 border ${
                        isTaskDone
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100'
                          : isTaskBlocked
                          ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700/60 hover:bg-red-100 animate-pulse'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700/60 hover:bg-amber-100'
                      }`}
                    >
                      {isTaskDone ? (
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                      ) : isTaskBlocked ? (
                        <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                      ) : (
                        <Clock className="w-2.5 h-2.5 text-amber-600" />
                      )}
                      <span>{task.title}</span>
                    </button>
                    {idx < orderedChain.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-ink-400 dark:text-slate-500 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Expand / Tooltip trigger */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1 text-xs font-mono rounded-lg border border-warmgray-border dark:border-dark-border bg-cream-100 dark:bg-dark-card hover:bg-cream-200 dark:hover:bg-dark-cardHover text-ink-700 dark:text-slate-300 transition-colors flex items-center gap-1 shadow-2xs"
          >
            <span>{isExpanded ? 'Less' : 'CPM Details'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Warning Callout: If critical path blocks project completion */}
      {isBlocked && blockedTasksOnPath.length > 0 && (
        <div className="px-4 py-3 bg-red-50/90 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900/60 text-red-950 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-red-800 dark:text-red-300 uppercase tracking-wide mr-1.5">
                ⚠️ Critical Path Blocked:
              </span>
              <span>
                Project completion is directly blocked by{' '}
                <button
                  type="button"
                  onClick={() => onSelectTask(blockedTasksOnPath[0])}
                  className="font-bold underline hover:opacity-80"
                >
                  "{blockedTasksOnPath[0].title}"
                </button>
                {blockedTasksOnPath[0].blockedReason ? ` (${blockedTasksOnPath[0].blockedReason})` : ''}.
                Because it is on the critical path, every day delayed postpones the overall project launch date.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectTask(blockedTasksOnPath[0])}
            className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors flex items-center gap-1 shrink-0 self-start sm:self-center shadow-xs"
          >
            <span>View Blocker</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Expanded CPM Analysis Section */}
      {isExpanded && (
        <div className="p-4 bg-cream-50/60 dark:bg-dark-card/50 border-t border-warmgray-border dark:border-dark-border text-xs text-ink-700 dark:text-slate-300">
          <div className="flex items-center gap-2 font-mono font-semibold text-ink-900 dark:text-slate-100 mb-2">
            <Info className="w-4 h-4 text-terracotta dark:text-neon-orange" />
            <span>Critical Path Method (CPM) Breakdown</span>
          </div>

          <p className="text-[11px] text-ink-500 dark:text-slate-400 font-mono mb-3 leading-relaxed">
            The critical path represents the longest chain of dependent activities required to complete the project.
            Tasks on this path have <strong>zero float</strong> (no scheduling slack): any delay directly pushes back the final completion deadline.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-white dark:bg-dark-surface border border-warmgray-border dark:border-dark-border">
              <span className="text-[10px] font-mono uppercase text-ink-400 dark:text-slate-500 block mb-0.5">
                Total Path Length
              </span>
              <span className="text-base font-bold font-mono text-terracotta dark:text-neon-orange">
                {totalDays} Days
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-dark-surface border border-warmgray-border dark:border-dark-border">
              <span className="text-[10px] font-mono uppercase text-ink-400 dark:text-slate-500 block mb-0.5">
                Tasks on Path
              </span>
              <span className="text-base font-bold font-mono text-ink-900 dark:text-slate-100">
                {orderedChain.length} Activities
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-dark-surface border border-warmgray-border dark:border-dark-border">
              <span className="text-[10px] font-mono uppercase text-ink-400 dark:text-slate-500 block mb-0.5">
                Path Status
              </span>
              <span className={`text-base font-bold font-mono ${isBlocked ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {isBlocked ? 'Blocked' : 'On Track'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-dark-surface border border-warmgray-border dark:border-dark-border">
              <span className="text-[10px] font-mono uppercase text-ink-400 dark:text-slate-500 block mb-0.5">
                Scheduling Slack
              </span>
              <span className="text-base font-bold font-mono text-ink-900 dark:text-slate-100">
                0 Days (Zero Float)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
