import React, { useEffect } from 'react';
import { Sun, Moon, Sparkles } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface ThemeToggleSwitchProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  showLabel?: boolean;
  className?: string;
  enableShortcut?: boolean;
}

export const ThemeToggleSwitch: React.FC<ThemeToggleSwitchProps> = ({
  theme,
  onToggleTheme,
  showLabel = true,
  className = '',
  enableShortcut = true,
}) => {
  const isDark = theme === 'dark';

  // Global Keyboard Shortcut: Press "T" (or Shift+T) anywhere to toggle theme
  useEffect(() => {
    if (!enableShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 't' || e.key === 'T') &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName) &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        soundManager.playSwitchToggle(!isDark);
        onToggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDark, onToggleTheme, enableShortcut]);

  const handleToggle = () => {
    soundManager.playSwitchToggle(!isDark);
    onToggleTheme();
  };

  return (
    <div
      onClick={handleToggle}
      className={`inline-flex items-center gap-2 cursor-pointer select-none group ${className}`}
      title={`Theme: ${isDark ? 'Dark Mode (Neon Pro)' : 'Light Mode (Clean Studio)'} • Shortcut: Press 'T'`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleToggle();
        }
      }}
    >
      {/* Tactile Toggle Switch Pill */}
      <div
        className={`relative w-14 h-7 rounded-full p-0.5 border transition-all duration-300 flex items-center shadow-inner ${
          isDark
            ? 'bg-slate-900 border-neon-teal/60 shadow-[0_0_12px_rgba(20,184,166,0.35)]'
            : 'bg-amber-100/90 border-amber-300 shadow-2xs'
        }`}
      >
        {/* Track icons (Sun on left, Moon & Stars on right) */}
        <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
          <Sun
            className={`w-3.5 h-3.5 transition-all duration-300 ${
              isDark ? 'text-slate-600 opacity-40 scale-75' : 'text-amber-600 opacity-90 scale-100'
            }`}
          />
          <div className="flex items-center gap-0.5">
            {isDark && (
              <Sparkles className="w-2.5 h-2.5 text-neon-teal animate-pulse opacity-80" />
            )}
            <Moon
              className={`w-3.5 h-3.5 transition-all duration-300 ${
                isDark ? 'text-neon-teal opacity-90 scale-100' : 'text-amber-800/40 opacity-40 scale-75'
              }`}
            />
          </div>
        </div>

        {/* Sliding Thumb with rotating icons */}
        <span
          className={`pointer-events-none w-6 h-6 rounded-full shadow-md transform transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center justify-center ${
            isDark
              ? 'translate-x-7 bg-slate-800 text-neon-teal border border-neon-teal/50 shadow-[0_0_8px_rgba(20,184,166,0.6)]'
              : 'translate-x-0 bg-white text-amber-500 border border-amber-200 shadow-sm'
          }`}
        >
          {isDark ? (
            <Moon className="w-3.5 h-3.5 fill-neon-teal/20 transform -rotate-12 transition-transform duration-300" />
          ) : (
            <Sun className="w-3.5 h-3.5 fill-amber-400 transform rotate-45 transition-transform duration-300" />
          )}
        </span>
      </div>

      {/* Optional Mode Label + Keyboard Shortcut Badge */}
      {showLabel && (
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span
            className={`font-semibold transition-colors duration-200 ${
              isDark ? 'text-teal-400 dark:text-neon-teal font-bold' : 'text-amber-800 font-bold'
            }`}
          >
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
          <kbd
            className="hidden sm:inline-block px-1 py-0.2 rounded bg-cream-200/90 dark:bg-dark-surface border border-warmgray-border dark:border-dark-border text-[9px] font-mono text-ink-400 dark:text-slate-500 shadow-2xs"
            title="Press 'T' to toggle theme"
          >
            T
          </kbd>
        </div>
      )}
    </div>
  );
};
