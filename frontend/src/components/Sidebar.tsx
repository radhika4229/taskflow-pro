import React from 'react';
import { ThemeToggleSwitch } from './ThemeToggleSwitch';
import { LayoutGrid, CalendarRange, Network, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export type ActiveTab = 'board' | 'timeline' | 'dependencies';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  apiConnected: boolean | null;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  apiConnected,
  theme = 'light',
  onToggleTheme,
}) => {
  const navItems = [
    { id: 'board' as ActiveTab, label: 'Board', icon: LayoutGrid },
    { id: 'timeline' as ActiveTab, label: 'Timeline', icon: CalendarRange },
    { id: 'dependencies' as ActiveTab, label: 'Dependencies', icon: Network },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-cream-50 dark:bg-dark-surface border-r border-warmgray-border dark:border-dark-border flex-col justify-between shrink-0 h-screen sticky top-0 select-none transition-colors duration-300">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-warmgray-border dark:border-dark-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-terracotta dark:bg-neon-orange flex items-center justify-center text-white font-bold text-sm shadow-sm">
                TF
              </div>
              <div>
                <h1 className="font-display font-semibold text-lg text-ink-900 dark:text-slate-100 tracking-tight leading-none">
                  TaskFlow <span className="text-terracotta dark:text-neon-orange font-normal">Pro</span>
                </h1>
                <p className="text-[11px] text-ink-500 dark:text-slate-400 font-mono tracking-wide mt-1 uppercase">
                  DAG Engine
                </p>
              </div>
            </div>

            {/* Compact theme toggle in sidebar header */}
            {onToggleTheme && (
              <ThemeToggleSwitch
                theme={theme}
                onToggleTheme={onToggleTheme}
                showLabel={false}
                enableShortcut={false}
              />
            )}
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-3 py-6">
          <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-slate-500">
            Workspace Views
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-terracotta dark:bg-neon-orange text-white shadow-sm'
                      : 'text-ink-700 dark:text-slate-300 hover:bg-cream-200/70 dark:hover:bg-dark-card hover:text-ink-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-ink-500 dark:text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* DAG Context Note */}
        <div className="px-4 py-3 mx-3 rounded-lg bg-cream-200/50 dark:bg-dark-card/60 border border-warmgray-border/70 dark:border-dark-border/80 text-xs text-ink-600 dark:text-slate-400 leading-relaxed">
          <p className="font-medium text-ink-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-terracotta dark:bg-neon-orange inline-block" />
            Dependency Flow
          </p>
          <p className="text-[11px] text-ink-500 dark:text-slate-400">
            Tasks automatically switch between <span className="font-medium text-badge-blocked dark:text-red-400">Blocked</span> and <span className="font-medium text-badge-ready dark:text-emerald-400">Ready</span> as prerequisites finish.
          </p>
        </div>
      </div>

      {/* Backend Status Footer */}
      <div className="p-4 border-t border-warmgray-border dark:border-dark-border text-xs text-ink-500 dark:text-slate-400 bg-cream-100/50 dark:bg-dark-card/40">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider font-mono text-ink-400 dark:text-slate-500">
            Backend API
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
              apiConnected === true
                ? 'bg-badge-readyBg dark:bg-emerald-950/40 text-badge-ready dark:text-emerald-400 border border-badge-readyBorder dark:border-emerald-800/60'
                : apiConnected === false
                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60'
                : 'bg-cream-300 dark:bg-dark-card text-ink-600 dark:text-slate-400'
            }`}
          >
            {apiConnected === true ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-badge-ready dark:text-emerald-400" /> API Active
              </>
            ) : apiConnected === false ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Placeholder Mode
              </>
            ) : (
              'Connecting...'
            )}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-ink-400 dark:text-slate-500 font-mono truncate" title={api.getBaseUrl()}>
          {api.getBaseUrl()}
        </div>
      </div>
    </aside>
  );
};
