import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task } from '../types';
import { ThemeToggleSwitch } from './ThemeToggleSwitch';
import { SoundToggleSwitch } from './SoundToggleSwitch';
import {
  Search,
  Plus,
  RefreshCw,
  Clock,
  History,
  Trash2,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
  Flame,
  X,
  ChevronRight,
  Zap,
} from 'lucide-react';

export type FilterChip = 'all' | 'blocked' | 'ready' | 'high_priority' | 'due_soon' | 'keystone' | 'leaf';

interface TopBarProps {
  tasks: Task[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilterChip: FilterChip;
  setActiveFilterChip: (chip: FilterChip) => void;
  onSelectTask: (task: Task) => void;
  onNewTaskClick: () => void;
  onRefreshClick: () => void;
  isRefreshing?: boolean;
  totalFilteredCount: number;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  tasks,
  searchQuery,
  setSearchQuery,
  activeFilterChip,
  setActiveFilterChip,
  onSelectTask,
  onNewTaskClick,
  onRefreshClick,
  isRefreshing = false,
  totalFilteredCount,
  soundEnabled = true,
  onToggleSound,
  theme = 'light',
  onToggleTheme,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('taskflow_recent_searches');
      return saved ? JSON.parse(saved) : ['database', 'api', 'tests'];
    } catch {
      return ['database', 'api', 'tests'];
    }
  });

  // Global Keyboard shortcut: "/" to focus search from anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsFocused(true);
      } else if (e.key === 'Escape') {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save to recent searches
  const addRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem('taskflow_recent_searches', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Clear search history
  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem('taskflow_recent_searches');
    } catch {
      // ignore
    }
  };

  // Autocomplete matching tasks preview
  const matchingTasks = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return tasks.filter((t) => {
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchStatus = t.status.toLowerCase().includes(q);
      const matchBlocked = t.blockedReason?.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchStatus || matchBlocked;
    }).slice(0, 5);
  }, [tasks, searchQuery]);

  // Compute counts for filter chips
  const chipCounts = useMemo(() => {
    const now = new Date().getTime();
    return {
      all: tasks.length,
      blocked: tasks.filter((t) => t.blocked).length,
      ready: tasks.filter((t) => !t.blocked && t.status !== 'DONE').length,
      high_priority: tasks.filter((t) => {
        const deps = tasks.filter((other) => other.prerequisiteIds?.includes(t.id));
        return deps.length >= 2 || (t.blocked && (t.prerequisiteIds?.length || 0) >= 2);
      }).length,
      due_soon: tasks.filter((t) => {
        if (t.status === 'DONE' || !t.endDate) return false;
        const diff = (new Date(t.endDate).getTime() - now) / 86400000;
        return diff <= 4;
      }).length,
      keystone: tasks.filter((t) => {
        const deps = tasks.filter((other) => other.prerequisiteIds?.includes(t.id));
        return deps.length >= 2;
      }).length,
      leaf: tasks.filter((t) => {
        const deps = tasks.filter((other) => other.prerequisiteIds?.includes(t.id));
        return deps.length === 0;
      }).length,
    };
  }, [tasks]);

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      addRecentSearch(searchQuery);
      setIsFocused(false);
    }
  };

  const isFiltered = searchQuery.trim().length > 0 || activeFilterChip !== 'all';

  return (
    <header className="px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 border-b border-warmgray-border dark:border-dark-border bg-cream-50/80 dark:bg-dark-surface/90 backdrop-blur-sm sticky top-0 z-30 flex flex-col gap-2 transition-colors duration-300">
      {/* Top Row: Breadcrumb, Search, Refresh, and New Task */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Breadcrumb & Project Scope (Desktop) */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-ink-500 dark:text-slate-400 font-mono">
          <span className="text-ink-400 dark:text-slate-500">TaskFlow</span>
          <span>/</span>
          <span className="text-ink-700 dark:text-slate-200 font-semibold">Sprint Core</span>
          <span>/</span>
          <span className="text-terracotta dark:text-neon-orange font-medium bg-terracotta-light dark:bg-orange-950/40 px-2 py-0.5 rounded border border-terracotta-border dark:border-orange-800/60">
            DAG Board
          </span>

          {/* Results count indicator */}
          {isFiltered && (
            <span className="ml-2 px-2 py-0.5 rounded bg-cream-200 dark:bg-dark-card border border-warmgray-border dark:border-dark-border text-ink-700 dark:text-slate-300 text-[11px] font-semibold animate-in fade-in">
              {totalFilteredCount} of {tasks.length} tasks
            </span>
          )}
        </div>

        {/* Mobile Mini Logo/Title */}
        <div className="flex sm:hidden items-center gap-1.5 shrink-0">
          <div className="w-6 h-6 rounded bg-terracotta dark:bg-neon-orange flex items-center justify-center text-white font-bold text-xs">
            TF
          </div>
          <span className="font-display font-semibold text-sm text-ink-900 dark:text-slate-100">
            TaskFlow
          </span>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefreshClick}
            disabled={isRefreshing}
            title="Refresh tasks from live server"
            className="p-2 rounded-lg border border-warmgray-border dark:border-dark-border text-ink-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-slate-100 hover:bg-cream-200/60 dark:hover:bg-dark-card transition-colors disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-terracotta dark:text-neon-orange' : ''}`} />
          </button>

          {/* Sound Effect Toggle Switch */}
          {onToggleSound && (
            <SoundToggleSwitch
              enabled={Boolean(soundEnabled)}
              onToggle={onToggleSound}
            />
          )}

          {/* Theme Toggle Switch (Day/Night with Neon Aura) */}
          {onToggleTheme && theme && (
            <ThemeToggleSwitch
              theme={theme}
              onToggleTheme={onToggleTheme}
              showLabel={true}
            />
          )}

          {/* Upgraded Search Input Container */}
          <div ref={containerRef} className="relative w-44 sm:w-64 md:w-80">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-ink-400 dark:text-slate-500 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDownInput}
                placeholder="Search tasks, blockers, dates..."
                className="w-full pl-9 pr-14 py-1.5 bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg text-xs text-ink-900 dark:text-slate-100 placeholder:text-ink-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-terracotta dark:focus:ring-neon-teal focus:border-terracotta dark:focus:border-neon-teal transition-all shadow-2xs"
              />

              {/* Right side: Clear button OR keyboard shortcut "/" */}
              <div className="absolute right-2.5 flex items-center gap-1">
                {searchQuery ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      inputRef.current?.focus();
                    }}
                    className="p-0.5 text-ink-400 hover:text-ink-700 text-xs font-mono"
                    title="Clear search"
                  >
                    ✕
                  </button>
                ) : (
                  <kbd
                    onClick={() => {
                      inputRef.current?.focus();
                      setIsFocused(true);
                    }}
                    className="px-1.5 py-0.5 rounded bg-cream-200 border border-warmgray-border text-[10px] font-mono text-ink-400 cursor-pointer hover:bg-cream-300"
                    title="Press '/' to focus search from anywhere"
                  >
                    /
                  </kbd>
                )}
              </div>
            </div>

            {/* Rich Search Dropdown (Autocomplete Suggestions, Recent Searches, Saved Filters) */}
            {isFocused && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-warmgray-border rounded-xl shadow-xl z-50 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100">
                {/* 1. Matching Task Autocomplete Results */}
                {searchQuery.trim() ? (
                  <div>
                    <div className="px-3 py-2 bg-cream-50 border-b border-warmgray-border/60 flex items-center justify-between text-[10px] font-mono text-ink-500 font-semibold uppercase">
                      <span>Matching Tasks ({matchingTasks.length})</span>
                      <span>Press Enter to filter</span>
                    </div>

                    {matchingTasks.length === 0 ? (
                      <div className="p-4 text-center text-ink-400 font-mono text-xs">
                        No tasks match "{searchQuery}"
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto divide-y divide-warmgray-border/40">
                        {matchingTasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() => {
                              addRecentSearch(task.title);
                              onSelectTask(task);
                              setIsFocused(false);
                            }}
                            className="p-2.5 hover:bg-cream-100/70 transition-colors cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-medium text-ink-900 truncate">
                                  {task.title}
                                </span>
                                <span className="text-[10px] font-mono text-ink-400 shrink-0">
                                  #{task.id.slice(0, 6)}
                                </span>
                              </div>
                              <p className="text-[11px] text-ink-500 truncate">
                                {task.description || (task.blocked ? task.blockedReason : 'Ready for execution')}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {task.blocked ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-badge-blockedBg text-badge-blocked border border-badge-blockedBorder">
                                  Blocked
                                </span>
                              ) : task.status === 'DONE' ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-badge-doneBg text-badge-done border border-badge-doneBorder">
                                  Done
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-badge-readyBg text-badge-ready border border-badge-readyBorder">
                                  Ready
                                </span>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 text-ink-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 2. Empty Query State: Saved Searches & Recent Searches */
                  <div className="p-3 space-y-3">
                    {/* Quick Saved Searches */}
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-400 mb-1.5 flex items-center gap-1">
                        <Bookmark className="w-3 h-3 text-terracotta" />
                        <span>Saved Searches</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilterChip('blocked');
                            setIsFocused(false);
                          }}
                          className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-xs font-mono flex items-center gap-1 transition-colors"
                        >
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          <span>My blocked tasks</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilterChip('high_priority');
                            setIsFocused(false);
                          }}
                          className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-mono flex items-center gap-1 transition-colors"
                        >
                          <Flame className="w-3 h-3 text-amber-600" />
                          <span>Critical bottlenecks</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilterChip('ready');
                            setIsFocused(false);
                          }}
                          className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-mono flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Ready to start</span>
                        </button>
                      </div>
                    </div>

                    {/* Recent Searches with Clear History Button */}
                    {recentSearches.length > 0 && (
                      <div className="pt-2 border-t border-warmgray-border/60">
                        <div className="flex items-center justify-between mb-1 text-[10px] font-mono uppercase tracking-wider text-ink-400">
                          <span className="flex items-center gap-1">
                            <History className="w-3 h-3 text-ink-400" />
                            <span>Recent Searches</span>
                          </span>
                          <button
                            type="button"
                            onClick={clearHistory}
                            className="text-ink-400 hover:text-red-700 flex items-center gap-0.5 hover:underline"
                            title="Clear search history"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>Clear history</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-1">
                          {recentSearches.map((term, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setSearchQuery(term);
                                setIsFocused(false);
                              }}
                              className="px-2 py-0.5 rounded bg-cream-100 hover:bg-cream-200 text-ink-700 text-xs font-mono flex items-center gap-1 transition-colors border border-warmgray-border/60"
                            >
                              <Clock className="w-2.5 h-2.5 text-ink-400" />
                              <span>{term}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* New Task Button (Desktop/Tablet) */}
          <button
            onClick={onNewTaskClick}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-terracotta hover:bg-terracotta-hover active:bg-terracotta-active text-white rounded-lg text-xs font-medium transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New task</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Quick Filter Chips (Horizontally Scrollable) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400 mr-1">
          Quick Filters:
        </span>

        {/* All Chip */}
        <button
          onClick={() => setActiveFilterChip('all')}
          className={`px-2.5 py-0.5 rounded-full text-xs font-mono transition-colors border ${
            activeFilterChip === 'all'
              ? 'bg-ink-900 dark:bg-slate-100 text-white dark:text-ink-900 border-ink-900 dark:border-slate-100 shadow-2xs font-semibold'
              : 'bg-white dark:bg-dark-card text-ink-600 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-cream-200 dark:hover:bg-dark-cardHover'
          }`}
        >
          All ({chipCounts.all})
        </button>

        {/* Blocked Chip */}
        <button
          onClick={() => setActiveFilterChip(activeFilterChip === 'blocked' ? 'all' : 'blocked')}
          className={`px-2.5 py-0.5 rounded-full text-xs font-mono transition-colors border flex items-center gap-1 ${
            activeFilterChip === 'blocked'
              ? 'bg-badge-blockedBg dark:bg-red-950/70 text-badge-blocked dark:text-red-300 border-badge-blocked dark:border-red-700 font-semibold ring-1 ring-badge-blocked dark:ring-red-600 shadow-2xs'
              : 'bg-white dark:bg-dark-card text-ink-700 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-badge-blockedBg/50 dark:hover:bg-red-950/40 hover:text-badge-blocked dark:hover:text-red-300'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-badge-blocked dark:bg-red-400" />
          <span>Blocked ({chipCounts.blocked})</span>
        </button>

        {/* Ready Chip */}
        <button
          onClick={() => setActiveFilterChip(activeFilterChip === 'ready' ? 'all' : 'ready')}
          className={`px-2.5 py-0.5 rounded-full text-xs font-mono transition-colors border flex items-center gap-1 ${
            activeFilterChip === 'ready'
              ? 'bg-badge-readyBg dark:bg-emerald-950/70 text-badge-ready dark:text-emerald-300 border-badge-ready dark:border-emerald-700 font-semibold ring-1 ring-badge-ready dark:ring-emerald-600 shadow-2xs'
              : 'bg-white dark:bg-dark-card text-ink-700 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-badge-readyBg/50 dark:hover:bg-emerald-950/40 hover:text-badge-ready dark:hover:text-emerald-300'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-badge-ready dark:bg-emerald-400" />
          <span>Ready ({chipCounts.ready})</span>
        </button>

        {/* High Priority Chip */}
        <button
          onClick={() => setActiveFilterChip(activeFilterChip === 'high_priority' ? 'all' : 'high_priority')}
          className={`px-2.5 py-0.5 rounded-full text-xs font-mono transition-colors border flex items-center gap-1 ${
            activeFilterChip === 'high_priority'
              ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-700 font-semibold ring-1 ring-amber-400 dark:ring-amber-500 shadow-2xs'
              : 'bg-white dark:bg-dark-card text-ink-700 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-900 dark:hover:text-amber-200'
          }`}
        >
          <Flame className="w-3 h-3 text-terracotta dark:text-neon-orange" />
          <span>Critical Path ({chipCounts.high_priority})</span>
        </button>

        {/* Due Soon Chip */}
        <button
          onClick={() => setActiveFilterChip(activeFilterChip === 'due_soon' ? 'all' : 'due_soon')}
          className={`px-2.5 py-0.5 rounded-full text-xs font-mono transition-colors border flex items-center gap-1 ${
            activeFilterChip === 'due_soon'
              ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 border-blue-400 dark:border-blue-700 font-semibold ring-1 ring-blue-400 dark:ring-blue-500 shadow-2xs'
              : 'bg-white dark:bg-dark-card text-ink-700 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-900 dark:hover:text-blue-200'
          }`}
        >
          <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span>Due Soon ({chipCounts.due_soon})</span>
        </button>

        {/* Key Blockers Chip (simplified from Keystone) */}
        <button
          onClick={() => setActiveFilterChip(activeFilterChip === 'keystone' ? 'all' : 'keystone')}
          className={`px-2.5 py-0.5 rounded-full text-xs font-mono transition-colors border flex items-center gap-1 ${
            activeFilterChip === 'keystone'
              ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border-purple-400 dark:border-purple-700 font-semibold ring-1 ring-purple-400 dark:ring-purple-500 shadow-2xs'
              : 'bg-white dark:bg-dark-card text-ink-700 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-900 dark:hover:text-purple-200'
          }`}
          title="Tasks that unlock 2 or more downstream tasks"
        >
          <Zap className="w-3 h-3 text-purple-600 dark:text-purple-400 fill-current" />
          <span>Key Blockers ({chipCounts.keystone})</span>
        </button>

        {/* Standalone Tasks Chip (simplified from Leaf) */}
        <button
          onClick={() => setActiveFilterChip(activeFilterChip === 'leaf' ? 'all' : 'leaf')}
          className={`px-2.5 py-0.5 rounded-full text-xs font-mono transition-colors border flex items-center gap-1 ${
            activeFilterChip === 'leaf'
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-400 dark:border-slate-600 font-semibold ring-1 ring-slate-400 shadow-2xs'
              : 'bg-white dark:bg-dark-card text-ink-700 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
          title="Independent tasks with 0 downstream dependents"
        >
          <span>🍃</span>
          <span>Standalone ({chipCounts.leaf})</span>
        </button>

        {/* Clear Filters Reset */}
        {isFiltered && (
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveFilterChip('all');
            }}
            className="ml-auto text-[11px] font-mono text-terracotta hover:underline flex items-center gap-0.5"
          >
            <span>Reset filters</span>
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </header>
  );
};
