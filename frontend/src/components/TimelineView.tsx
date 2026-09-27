import React, { useState, useMemo } from 'react';
import { Task } from '../types';
import { calculateCriticalPath } from '../utils/criticalPath';
import {
  Calendar,
  Flame,
  Lock,
  Clock,
  Filter,
  ExternalLink,
} from 'lucide-react';

interface TimelineViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

type TimelineFilter = 'all' | 'critical' | 'blocked' | 'due_soon';

export const TimelineView: React.FC<TimelineViewProps> = ({ tasks, onTaskClick }) => {
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // 1. Calculate Critical Path using CPM utility
  const criticalPath = useMemo(() => calculateCriticalPath(tasks), [tasks]);
  const criticalPathNodeIds = criticalPath.criticalPathNodeIds;

  // 2. Timeline date range calculation
  const { minDate, totalDays, dayList } = useMemo(() => {
    const dates: number[] = [];
    tasks.forEach((t) => {
      if (t.startDate) dates.push(new Date(t.startDate).getTime());
      if (t.endDate) dates.push(new Date(t.endDate).getTime());
    });

    const now = new Date();
    // Default baseline around late September / early October
    const baseStart = dates.length > 0 ? Math.min(...dates) : now.getTime() - 2 * 86400000;
    const baseEnd = dates.length > 0 ? Math.max(...dates) : now.getTime() + 12 * 86400000;

    const min = new Date(baseStart);
    min.setHours(0, 0, 0, 0);

    const max = new Date(baseEnd);
    max.setHours(23, 59, 59, 999);

    // Ensure at least 14 days span
    const daySpan = Math.max(14, Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const list: Date[] = [];
    for (let i = 0; i < daySpan; i++) {
      const d = new Date(min.getTime() + i * 86400000);
      list.push(d);
    }

    return { minDate: min, maxDate: max, totalDays: daySpan, dayList: list };
  }, [tasks]);

  // 3. Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (activeFilter === 'critical') return criticalPathNodeIds.has(t.id);
      if (activeFilter === 'blocked') return t.blocked;
      if (activeFilter === 'due_soon') {
        if (t.status === 'DONE') return false;
        if (!t.endDate) return true;
        const diff = (new Date(t.endDate).getTime() - new Date().getTime()) / 86400000;
        return diff <= 4;
      }
      return true;
    }).sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate.localeCompare(b.startDate);
    });
  }, [tasks, activeFilter, criticalPathNodeIds]);

  // 4. Milestone markers
  const milestones = useMemo(() => {
    if (dayList.length < 10) return [];
    return [
      {
        name: 'API Freeze',
        dayIndex: Math.min(dayList.length - 2, 4),
        date: dayList[Math.min(dayList.length - 2, 4)],
        color: 'border-purple-500 text-purple-700 bg-purple-100',
      },
      {
        name: 'Beta Gate',
        dayIndex: Math.min(dayList.length - 1, 9),
        date: dayList[Math.min(dayList.length - 1, 9)],
        color: 'border-amber-500 text-amber-700 bg-amber-100',
      },
    ];
  }, [dayList]);

  // 5. Today's position calculation
  const todayPositionPercent = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diff = today.getTime() - minDate.getTime();
    const pct = (diff / (totalDays * 86400000)) * 100;
    return Math.max(5, Math.min(95, pct));
  }, [minDate, totalDays]);

  // 6. Gantt coordinate helper
  const getBarCoordinates = (task: Task) => {
    let startMs = task.startDate ? new Date(task.startDate).getTime() : minDate.getTime() + 86400000;
    let endMs = task.endDate ? new Date(task.endDate).getTime() : startMs + 2 * 86400000;

    if (endMs <= startMs) endMs = startMs + 86400000;

    const startDiff = startMs - minDate.getTime();
    const durationDiff = endMs - startMs;
    const totalMs = totalDays * 86400000;

    const left = Math.max(0, Math.min(95, (startDiff / totalMs) * 100));
    const width = Math.max(4, Math.min(100 - left, (durationDiff / totalMs) * 100));

    return { left, width };
  };

  // Color mapping: Red (Blocked) → Yellow (Ready) → Green (Done)
  const getBarColorStyle = (task: Task, isCritical: boolean) => {
    if (task.blocked) {
      return {
        bg: 'bg-red-500 text-white',
        border: 'border-red-600',
        badge: 'bg-red-100 text-red-900 border-red-300',
        label: 'Blocked',
        glow: isCritical ? 'shadow-[0_0_14px_rgba(239,68,68,0.8)] ring-2 ring-red-400 border-2 border-red-400' : 'shadow-sm',
      };
    }
    if (task.status === 'DONE') {
      return {
        bg: 'bg-emerald-600 text-white',
        border: 'border-emerald-700',
        badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        label: 'Done',
        glow: isCritical ? 'shadow-[0_0_14px_rgba(16,185,129,0.8)] ring-2 ring-emerald-400 border-2 border-emerald-400' : 'shadow-sm',
      };
    }
    // Ready
    return {
      bg: 'bg-amber-400 text-amber-950 font-semibold',
      border: 'border-amber-500',
      badge: 'bg-amber-100 text-amber-900 border-amber-300',
      label: 'Ready',
      glow: isCritical ? 'shadow-[0_0_16px_rgba(234,88,12,0.9)] ring-2 ring-orange-500 border-2 border-orange-500 animate-critical-glow' : 'shadow-sm',
    };
  };

  const ROW_HEIGHT = 56;
  const GANTT_LEFT_WIDTH = 280;

  return (
    <div className="bg-cream-100/70 dark:bg-dark-surface/90 rounded-xl border border-warmgray-border dark:border-dark-border p-6 shadow-subtle flex flex-col transition-colors duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-warmgray-border dark:border-dark-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-terracotta dark:text-neon-orange" />
            <h3 className="font-display text-2xl font-medium text-ink-900 dark:text-slate-100 tracking-tight">
              Gantt Schedule & Dependency Timeline
            </h3>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-cream-200 dark:bg-dark-card border border-warmgray-border dark:border-dark-border text-ink-700 dark:text-slate-300">
              {filteredTasks.length} Visible Tasks • {totalDays} Day Scope
            </span>
          </div>
          <p className="text-xs text-ink-500 dark:text-slate-400 font-mono">
            Interactive Gantt bars with dependency link arrows, milestone markers, critical path glow, and live countdowns.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-ink-400 dark:text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>

          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors border ${
              activeFilter === 'all'
                ? 'bg-ink-900 dark:bg-slate-100 text-white dark:text-slate-900 border-ink-900 dark:border-slate-100 shadow-xs'
                : 'bg-white dark:bg-dark-card text-ink-600 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-cream-200 dark:hover:bg-dark-cardHover'
            }`}
          >
            All Tasks ({tasks.length})
          </button>

          <button
            onClick={() => setActiveFilter('critical')}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors border flex items-center gap-1 ${
              activeFilter === 'critical'
                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-400 dark:border-amber-700 font-semibold shadow-xs'
                : 'bg-white dark:bg-dark-card text-ink-600 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-cream-200 dark:hover:bg-dark-cardHover'
            }`}
          >
            <Flame className="w-3 h-3 text-terracotta dark:text-neon-orange" />
            <span>Critical Path ({criticalPathNodeIds.size})</span>
          </button>

          <button
            onClick={() => setActiveFilter('blocked')}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors border flex items-center gap-1 ${
              activeFilter === 'blocked'
                ? 'bg-red-100 dark:bg-red-950/40 text-red-900 dark:text-red-300 border-red-300 dark:border-red-700 font-semibold shadow-xs'
                : 'bg-white dark:bg-dark-card text-ink-600 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-cream-200 dark:hover:bg-dark-cardHover'
            }`}
          >
            <Lock className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span>Blocked ({tasks.filter((t) => t.blocked).length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('due_soon')}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors border flex items-center gap-1 ${
              activeFilter === 'due_soon'
                ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-semibold shadow-xs'
                : 'bg-white dark:bg-dark-card text-ink-600 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-cream-200 dark:hover:bg-dark-cardHover'
            }`}
          >
            <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>Due Soon</span>
          </button>
        </div>
      </div>

      {/* Legend & Milestone Info Bar */}
      <div className="flex items-center justify-between gap-4 mb-4 px-3 py-2 bg-white/90 dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg text-xs font-mono flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-ink-400 dark:text-slate-400 font-semibold uppercase text-[10px]">
            Gantt Legend:
          </span>
          <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400">
            <span className="w-3 h-3 rounded bg-red-500 border border-red-600" />
            Red: Blocked
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="w-3 h-3 rounded bg-amber-400 border border-amber-500" />
            Yellow: Ready
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <span className="w-3 h-3 rounded bg-emerald-600 border border-emerald-700" />
            Green: Done
          </span>
          <span className="inline-flex items-center gap-1.5 text-terracotta dark:text-neon-orange">
            <span className="w-4 h-2 rounded bg-terracotta dark:bg-neon-orange ring-2 ring-terracotta/50 dark:ring-neon-orange/50" />
            Glowing: Critical Path
          </span>
          <span className="inline-flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
            <span className="w-2.5 h-2.5 rotate-45 bg-purple-600" />
            Milestone Marker
          </span>
        </div>

        <div className="text-[11px] text-ink-400 dark:text-slate-400">
          Arrows connect prerequisites to dependent tasks
        </div>
      </div>

      {/* Gantt Chart Container */}
      <div className="relative border border-warmgray-border dark:border-dark-border rounded-xl bg-white dark:bg-dark-bg overflow-x-auto shadow-inner">
        <div className="min-w-[1000px]">
          {/* Header Row: Task Column + Days Grid */}
          <div className="flex items-center border-b border-warmgray-border dark:border-dark-border bg-cream-50 dark:bg-dark-surface sticky top-0 z-20">
            {/* Task Name Column Header */}
            <div
              style={{ width: `${GANTT_LEFT_WIDTH}px` }}
              className="p-3 font-mono text-[11px] font-semibold text-ink-600 dark:text-slate-300 uppercase tracking-wider border-r border-warmgray-border dark:border-dark-border shrink-0 flex items-center justify-between"
            >
              <span>Task & Schedule</span>
              <span>Status</span>
            </div>

            {/* Days Calendar Timescale Header */}
            <div className="flex-1 relative flex">
              {dayList.map((day, idx) => {
                const dayStr = day.toLocaleDateString('en-US', { weekday: 'narrow' });
                const dateNum = day.getDate();
                const monthStr = day.toLocaleDateString('en-US', { month: 'short' });
                const isFirstOfMonth = dateNum === 1 || idx === 0;

                return (
                  <div
                    key={idx}
                    className="flex-1 border-r border-warmgray-border/50 dark:border-dark-border/60 py-2 px-1 text-center font-mono text-[10px] text-ink-500 dark:text-slate-400 select-none"
                  >
                    {isFirstOfMonth && (
                      <span className="block text-[9px] font-bold text-terracotta dark:text-neon-orange uppercase">
                        {monthStr}
                      </span>
                    )}
                    <span className="block font-medium text-ink-700 dark:text-slate-200">{dateNum}</span>
                    <span className="text-[9px] text-ink-400 dark:text-slate-500">{dayStr}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gantt Body with Task Rows */}
          <div className="relative">
            {/* Background Grid Lines & Vertical Markers */}
            <div className="absolute inset-0 left-[280px] pointer-events-none flex">
              {dayList.map((_, idx) => (
                <div key={idx} className="flex-1 border-r border-warmgray-border/30 dark:border-dark-border/40 h-full" />
              ))}
            </div>

            {/* Today's Vertical Dashed Line Marker */}
            <div
              style={{ left: `calc(280px + (100% - 280px) * ${todayPositionPercent / 100})` }}
              className="absolute top-0 bottom-0 z-10 pointer-events-none border-l-2 border-dashed border-terracotta flex flex-col items-center"
            >
              <div className="sticky top-0 bg-terracotta text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded -translate-x-1/2 shadow-xs uppercase tracking-wider">
                ● Today
              </div>
            </div>

            {/* Milestone Vertical Markers */}
            {milestones.map((m, idx) => (
              <div
                key={idx}
                style={{
                  left: `calc(280px + (100% - 280px) * ${(m.dayIndex / totalDays)})`,
                }}
                className="absolute top-0 bottom-0 z-10 pointer-events-none border-l-2 border-dotted border-purple-500 flex flex-col items-center"
              >
                <div className="sticky top-0 bg-purple-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded -translate-x-1/2 shadow-xs flex items-center gap-1">
                  <span>◆</span>
                  <span>{m.name}</span>
                </div>
              </div>
            ))}

            {/* SVG Dependency Arrows Layer */}
            <svg className="absolute inset-0 pointer-events-none z-10 w-full h-full overflow-visible">
              <defs>
                <marker
                  id="gantt-arrow-green"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#16A34A" />
                </marker>
                <marker
                  id="gantt-arrow-red"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#DC2626" />
                </marker>
                <marker
                  id="gantt-arrow-amber"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#D97748" />
                </marker>
                <marker
                  id="gantt-arrow-critical"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#EA580C" />
                </marker>
              </defs>

              {filteredTasks.map((targetTask, targetRowIdx) => {
                const targetCoords = getBarCoordinates(targetTask);

                return (targetTask.prerequisiteIds || []).map((sourceId) => {
                  const sourceRowIdx = filteredTasks.findIndex((t) => t.id === sourceId);
                  if (sourceRowIdx === -1) return null;

                  const sourceTask = filteredTasks[sourceRowIdx];
                  const sourceCoords = getBarCoordinates(sourceTask);

                  // Calculate pixel positions
                  const sourceY = sourceRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const targetY = targetRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                  const isCriticalLink = criticalPathNodeIds.has(sourceId) && criticalPathNodeIds.has(targetTask.id);
                  const isBlockedByThis = targetTask.blocked && sourceTask.status !== 'DONE';
                  const strokeColor = isCriticalLink
                    ? '#EA580C'
                    : isBlockedByThis
                    ? '#DC2626'
                    : sourceTask.status === 'DONE'
                    ? '#16A34A'
                    : '#D97748';
                  const markerId = isCriticalLink
                    ? 'gantt-arrow-critical'
                    : isBlockedByThis
                    ? 'gantt-arrow-red'
                    : sourceTask.status === 'DONE'
                    ? 'gantt-arrow-green'
                    : 'gantt-arrow-amber';

                  return (
                    <path
                      key={`${sourceId}->${targetTask.id}`}
                      d={`M calc(280px + (100% - 280px) * ${sourceCoords.left + sourceCoords.width} / 100) ${sourceY} C calc(280px + (100% - 280px) * ${(sourceCoords.left + sourceCoords.width + 3)} / 100) ${sourceY}, calc(280px + (100% - 280px) * ${(targetCoords.left - 3)} / 100) ${targetY}, calc(280px + (100% - 280px) * ${targetCoords.left} / 100) ${targetY}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isCriticalLink ? 3.5 : isBlockedByThis ? 2 : 1.5}
                      strokeDasharray={!isCriticalLink && isBlockedByThis ? '4 3' : undefined}
                      markerEnd={`url(#${markerId})`}
                      opacity={hoveredTaskId ? (targetTask.id === hoveredTaskId || sourceId === hoveredTaskId ? 1 : 0.2) : 0.85}
                      className={isCriticalLink ? 'animate-critical-glow' : isBlockedByThis ? 'animate-chain-flow' : ''}
                    />
                  );
                });
              })}
            </svg>

            {/* Task Rows & Gantt Bars */}
            {filteredTasks.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-ink-400">
                No tasks match the selected filter.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isCritical = criticalPathNodeIds.has(task.id);
                const colorStyle = getBarColorStyle(task, isCritical);
                const coords = getBarCoordinates(task);
                const isHovered = hoveredTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    className={`flex items-center border-b border-warmgray-border/60 dark:border-dark-border/60 hover:bg-cream-100/50 dark:hover:bg-dark-cardHover/50 transition-colors ${
                      isHovered ? 'bg-cream-100/60 dark:bg-dark-cardHover/70' : ''
                    }`}
                  >
                    {/* Left Task Sidebar Column */}
                    <div
                      style={{ width: `${GANTT_LEFT_WIDTH}px` }}
                      onClick={() => onTaskClick(task)}
                      className="px-3 border-r border-warmgray-border/70 dark:border-dark-border flex items-center justify-between gap-2 shrink-0 cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-ink-400 dark:text-slate-400">
                            #{task.id.slice(0, 6)}
                          </span>
                          {isCritical && (
                            <span
                              className="text-[9px] font-mono px-1 py-0.2 rounded bg-terracotta text-white font-semibold flex items-center gap-0.5"
                              title="This task is on critical path - any delay affects deadline"
                            >
                              <Flame className="w-2.5 h-2.5" />
                              <span>CP</span>
                            </span>
                          )}
                        </div>
                        <h5 className="text-xs font-medium text-ink-900 dark:text-slate-100 truncate group-hover:text-terracotta dark:group-hover:text-neon-orange transition-colors">
                          {task.title}
                        </h5>
                      </div>

                      {/* Small Status Pill */}
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold uppercase shrink-0 ${colorStyle.badge}`}
                      >
                        {colorStyle.label}
                      </span>
                    </div>

                    {/* Right Gantt Bar Track */}
                    <div className="flex-1 relative h-full flex items-center px-1">
                      <div
                        onClick={() => onTaskClick(task)}
                        style={{
                          left: `${coords.left}%`,
                          width: `${coords.width}%`,
                        }}
                        className={`absolute h-8 rounded-lg border flex items-center justify-between px-2.5 text-xs font-medium cursor-pointer transition-all duration-150 z-10 ${
                          colorStyle.bg
                        } ${colorStyle.border} ${colorStyle.glow} ${
                          isHovered ? 'scale-[1.02] shadow-md ring-2 ring-terracotta/40 dark:ring-neon-orange/50' : ''
                        }`}
                        title={
                          isCritical
                            ? `${task.title} — This task is on critical path - any delay affects deadline (${task.startDate || ''} to ${task.endDate || ''})`
                            : `${task.title} (${task.status}) - ${task.startDate || 'No start'} to ${task.endDate || 'No end'}`
                        }
                      >
                        <span className="truncate text-xs font-medium flex items-center gap-1">
                          {isCritical && <Flame className="w-3 h-3 text-white fill-current shrink-0" />}
                          <span className="truncate">{task.title}</span>
                        </span>

                        <span className="text-[10px] font-mono opacity-80 shrink-0 ml-1">
                          {task.endDate ? task.endDate.slice(5) : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Selected/Hovered Task Context Footer */}
      {hoveredTaskId && (
        <div className="mt-4 p-3 bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg text-xs flex items-center justify-between gap-4 animate-in fade-in duration-150">
          {(() => {
            const hTask = tasks.find((t) => t.id === hoveredTaskId);
            if (!hTask) return null;
            const isCrit = criticalPathNodeIds.has(hTask.id);

            return (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink-900 dark:text-slate-100">{hTask.title}</span>
                  <span className="text-ink-400 dark:text-slate-400 font-mono">({hTask.status})</span>
                  {isCrit && (
                    <span className="text-terracotta dark:text-neon-orange font-mono font-bold flex items-center gap-1">
                      <Flame className="w-3 h-3" /> Critical Path
                    </span>
                  )}
                  {hTask.blocked && (
                    <span className="text-red-700 dark:text-red-400 font-mono">
                      ⛔ {hTask.blockedReason || 'Blocked by prerequisites'}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onTaskClick(hTask)}
                  className="text-terracotta dark:text-neon-orange hover:underline font-mono text-[11px] flex items-center gap-1 shrink-0"
                >
                  <span>Open Task Details</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
