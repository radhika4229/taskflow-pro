import React from 'react';

export const HeroSection: React.FC = () => {
  return (
    <div className="mb-8 select-none">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-terracotta dark:text-neon-orange bg-terracotta-light dark:bg-orange-950/40 border border-terracotta-border dark:border-orange-800/60 px-2 py-0.5 rounded">
          TaskFlow Pro
        </span>
        <span className="text-xs text-ink-500 dark:text-slate-400 font-mono">
          Smart Dependency Kanban • Automatic Blocked & Ready Status
        </span>
      </div>
      <h2 className="font-display text-3xl md:text-4xl text-ink-900 dark:text-slate-100 font-medium tracking-tight leading-[1.18] max-w-3xl transition-colors">
        Work that flows in sequence, <br />
        <span className="italic font-normal text-ink-700 dark:text-slate-300">never blocked unexpectedly.</span>
      </h2>
      <p className="mt-2 text-sm text-ink-600 dark:text-slate-400 max-w-2xl font-normal leading-relaxed transition-colors">
        Tasks are connected by prerequisites. When a blocker task is completed, downstream tasks automatically unlock to <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">Ready</strong>.
      </p>
    </div>
  );
};
