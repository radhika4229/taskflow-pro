import React, { useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface SoundToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  showLabel?: boolean;
  className?: string;
  enableShortcut?: boolean;
}

export const SoundToggleSwitch: React.FC<SoundToggleSwitchProps> = ({
  enabled,
  onToggle,
  showLabel = false,
  className = '',
  enableShortcut = true,
}) => {
  // Global Keyboard Shortcut: Press "M" to toggle sound mute
  useEffect(() => {
    if (!enableShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'm' || e.key === 'M') &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName) &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        soundManager.playSwitchToggle(!enabled);
        onToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onToggle, enableShortcut]);

  const handleToggle = () => {
    soundManager.playSwitchToggle(!enabled);
    onToggle();
  };

  return (
    <div
      onClick={handleToggle}
      className={`inline-flex items-center gap-1.5 cursor-pointer select-none group ${className}`}
      title={`Movement Chimes: ${enabled ? 'ON (Click to mute)' : 'MUTED (Click to unmute)'} • Shortcut: Press 'M'`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleToggle();
        }
      }}
    >
      <div
        className={`p-1.5 rounded-lg border transition-all duration-200 flex items-center gap-1.5 shadow-2xs ${
          enabled
            ? 'border-terracotta-border dark:border-orange-800/60 bg-terracotta-light/70 dark:bg-orange-950/40 text-terracotta dark:text-neon-orange hover:bg-terracotta-light'
            : 'border-warmgray-border dark:border-dark-border text-ink-400 dark:text-slate-500 hover:text-ink-700 dark:hover:text-slate-300 hover:bg-cream-200/60 dark:hover:bg-dark-cardHover'
        }`}
      >
        {enabled ? (
          <>
            <Volume2 className="w-4 h-4 shrink-0 text-terracotta dark:text-neon-orange" />
            {/* Equalizer Micro-bars */}
            <div className="flex items-end gap-0.5 h-3.5 px-0.5">
              <span className="w-0.5 h-2 bg-terracotta dark:bg-neon-orange rounded-full animate-pulse" />
              <span className="w-0.5 h-3.5 bg-terracotta dark:bg-neon-orange rounded-full animate-pulse [animation-delay:150ms]" />
              <span className="w-0.5 h-2.5 bg-terracotta dark:bg-neon-orange rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
          </>
        ) : (
          <VolumeX className="w-4 h-4 shrink-0 text-ink-400 dark:text-slate-500" />
        )}
      </div>

      {showLabel && (
        <span className="hidden xl:inline text-xs font-mono font-medium text-ink-600 dark:text-slate-400">
          {enabled ? 'Sound On' : 'Muted'}
        </span>
      )}
    </div>
  );
};
