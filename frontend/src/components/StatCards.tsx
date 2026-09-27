import React, { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Info,
  Layers,
} from 'lucide-react';

interface StatCardsProps {
  tasks: Task[];
}

export const StatCards: React.FC<StatCardsProps> = ({ tasks }) => {
  const total = tasks.length;
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const blocked = tasks.filter((t) => t.blocked).length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const ready = tasks.filter(
    (t) => !t.blocked && t.status !== 'DONE' && t.status !== 'IN_PROGRESS'
  ).length;

  // Track previous values for change animation
  const prevValuesRef = useRef({ total, inProgress, blocked, done });
  const [improvedStats, setImprovedStats] = useState<Record<string, boolean>>({});
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    const prev = prevValuesRef.current;
    const newImproved: Record<string, boolean> = {};

    // Check if stat improved: Done up, Blocked down, Total up
    if (done > prev.done) newImproved['Done'] = true;
    if (blocked < prev.blocked) newImproved['Blocked'] = true;
    if (total > prev.total) newImproved['Total Tasks'] = true;
    if (inProgress !== prev.inProgress) newImproved['In Progress'] = true;

    if (Object.keys(newImproved).length > 0) {
      setImprovedStats(newImproved);
      const timer = setTimeout(() => setImprovedStats({}), 2000);
      return () => clearTimeout(timer);
    }

    prevValuesRef.current = { total, inProgress, blocked, done };
  }, [total, inProgress, blocked, done]);

  // Mini Sparkline Generator
  const renderSparkline = (
    data: number[],
    color: string,
    gradId: string
  ) => {
    const width = 74;
    const height = 24;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 6) - 3;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const lastPoint = points.split(' ').pop()?.split(',') || ['74', '12'];

    return (
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Fill polygon */}
        <polygon
          points={`0,${height} ${points} ${width},${height}`}
          fill={`url(#${gradId})`}
        />

        {/* Stroke polyline */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />

        {/* End dot */}
        <circle
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r="2.5"
          fill={color}
          className="animate-pulse"
        />
      </svg>
    );
  };

  const stats = [
    {
      label: 'Total Tasks',
      value: total,
      sublabel: 'Active DAG nodes',
      delta: '+1 today',
      trend: 'up',
      trendGood: true,
      pillClass: 'bg-cream-200 text-ink-700',
      sparkColor: '#D97748',
      sparkData: [6, 7, 7, 8, 8, 9, Math.max(9, total)],
      gradId: 'total-grad',
    },
    {
      label: 'In Progress',
      value: inProgress,
      sublabel: 'Currently executing',
      delta: '+1 active',
      trend: 'up',
      trendGood: true,
      pillClass: 'bg-terracotta-light text-terracotta border border-terracotta-border',
      sparkColor: '#D97748',
      sparkData: [2, 3, 2, 4, 3, 2, Math.max(1, inProgress)],
      gradId: 'prog-grad',
    },
    {
      label: 'Blocked',
      value: blocked,
      sublabel: 'Prerequisites pending',
      delta: '-1 cleared',
      trend: 'down',
      trendGood: true, // fewer blockers is good!
      pillClass: 'bg-badge-blockedBg text-badge-blocked border border-badge-blockedBorder',
      sparkColor: '#EF4444',
      sparkData: [5, 4, 4, 3, 3, 2, Math.max(1, blocked)],
      gradId: 'block-grad',
    },
    {
      label: 'Done',
      value: done,
      sublabel: 'Prerequisites cleared',
      delta: '+2 today',
      trend: 'up',
      trendGood: true,
      pillClass: 'bg-badge-readyBg text-badge-ready border border-badge-readyBorder',
      sparkColor: '#16A34A',
      sparkData: [0, 1, 1, 2, 3, 3, Math.max(1, done)],
      gradId: 'done-grad',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => {
        const isImproved = improvedStats[stat.label];
        const isHovered = hoveredCard === stat.label;

        return (
          <div
            key={stat.label}
            onMouseEnter={() => setHoveredCard(stat.label)}
            onMouseLeave={() => setHoveredCard(null)}
            className="relative group bg-cream-50 dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-xl p-4 shadow-subtle flex flex-col justify-between hover:border-ink-400 dark:hover:border-slate-500 hover:shadow-card transition-all duration-300 cursor-pointer"
          >
            {/* Card Header: Label, Trend Delta & Pill */}
            <div className="flex items-center justify-between gap-1 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-ink-600 dark:text-slate-300 font-medium">{stat.label}</span>
                <Info className="w-3 h-3 text-ink-400 dark:text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Trend Pill with Up/Down Arrow & Delta */}
              <div className="flex items-center gap-1">
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border ${
                    stat.trendGood
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/60'
                  }`}
                  title={`${stat.label} delta`}
                >
                  {stat.trend === 'up' ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  <span>{stat.delta}</span>
                </span>
              </div>
            </div>

            {/* Middle Section: Animated Counter + Sparkline Chart */}
            <div className="flex items-end justify-between gap-2 my-1">
              <div>
                {/* Number with Slide-up Animation */}
                <div className="h-9 overflow-hidden flex items-center">
                  <div
                    key={stat.value}
                    className={`font-display text-3xl font-medium tracking-tight animate-counter-slide-up ${
                      isImproved
                        ? 'animate-color-improve text-emerald-600 dark:text-emerald-400'
                        : 'text-ink-900 dark:text-slate-100'
                    }`}
                  >
                    {stat.value}
                  </div>
                </div>

                <div className="text-[11px] text-ink-400 dark:text-slate-500 font-mono mt-0.5">
                  {stat.sublabel}
                </div>
              </div>

              {/* Sparkline Mini-Chart */}
              <div className="pb-1 opacity-80 group-hover:opacity-100 transition-opacity">
                {renderSparkline(stat.sparkData, stat.sparkColor, stat.gradId)}
              </div>
            </div>

            {/* Hover Tooltip: Breakdown by Status (4 blocked, 2 ready, 1 done) */}
            {isHovered && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 right-0 top-full mt-2 z-40 bg-white/98 backdrop-blur-sm border border-warmgray-border rounded-xl p-3.5 shadow-xl text-ink-900 text-xs animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-warmgray-border/80">
                  <div className="flex items-center gap-1.5 font-semibold text-ink-800 font-display">
                    <Layers className="w-3.5 h-3.5 text-terracotta" />
                    <span>Project Status Breakdown</span>
                  </div>
                  <span className="text-[10px] font-mono text-ink-500">
                    {total} tasks total
                  </span>
                </div>

                {/* Stacked Breakdown Progress Bar */}
                <div className="w-full h-2 rounded-full overflow-hidden flex mb-2.5 bg-cream-200">
                  <div
                    style={{ width: `${total > 0 ? (blocked / total) * 100 : 0}%` }}
                    className="h-full bg-red-500 transition-all"
                    title={`Blocked: ${blocked}`}
                  />
                  <div
                    style={{ width: `${total > 0 ? (ready / total) * 100 : 0}%` }}
                    className="h-full bg-amber-400 transition-all"
                    title={`Ready: ${ready}`}
                  />
                  <div
                    style={{ width: `${total > 0 ? (inProgress / total) * 100 : 0}%` }}
                    className="h-full bg-terracotta transition-all"
                    title={`In Progress: ${inProgress}`}
                  />
                  <div
                    style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                    className="h-full bg-emerald-600 transition-all"
                    title={`Done: ${done}`}
                  />
                </div>

                {/* Itemized Legend: 4 blocked, 2 ready, 1 done */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 text-red-700">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <span className="font-semibold">{blocked}</span>
                    <span className="text-ink-600">blocked</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-700">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-semibold">{ready}</span>
                    <span className="text-ink-600">ready</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-terracotta">
                    <span className="w-2 h-2 rounded-full bg-terracotta shrink-0" />
                    <span className="font-semibold">{inProgress}</span>
                    <span className="text-ink-600">in progress</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                    <span className="font-semibold">{done}</span>
                    <span className="text-ink-600">done</span>
                  </div>
                </div>

                <div className="mt-2.5 pt-1.5 border-t border-warmgray-border/60 text-[10px] text-ink-400 font-mono flex items-center justify-between">
                  <span>DAG Health Index</span>
                  <span className="font-semibold text-emerald-600">
                    {total > 0 ? Math.round(((done + ready) / total) * 100) : 100}% unblocked
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
