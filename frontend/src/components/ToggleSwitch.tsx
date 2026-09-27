import React from 'react';
import { soundManager } from '../utils/sound';

export type ToggleColor =
  | 'terracotta'
  | 'teal'
  | 'purple'
  | 'emerald'
  | 'amber'
  | 'blue'
  | 'red';

export type ToggleSize = 'sm' | 'md' | 'lg';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: ToggleSize;
  label?: React.ReactNode;
  description?: string;
  iconOn?: React.ReactNode;
  iconOff?: React.ReactNode;
  activeColor?: ToggleColor;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  playSound?: boolean;
  reverse?: boolean; // puts label on the right vs left
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  size = 'md',
  label,
  description,
  iconOn,
  iconOff,
  activeColor = 'terracotta',
  disabled = false,
  ariaLabel,
  className = '',
  playSound = true,
  reverse = false,
}) => {
  const handleToggle = () => {
    if (disabled) return;
    const nextVal = !checked;
    if (playSound) {
      soundManager.playSwitchToggle(nextVal);
    }
    onChange(nextVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  // Size styling maps
  const trackSizeClasses: Record<ToggleSize, string> = {
    sm: 'w-8 h-4.5 p-0.5',
    md: 'w-11 h-6 p-0.5',
    lg: 'w-14 h-7.5 p-1',
  };

  const thumbSizeClasses: Record<ToggleSize, string> = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-5.5 h-5.5',
  };

  const thumbTranslateClasses: Record<ToggleSize, string> = {
    sm: checked ? 'translate-x-3.5' : 'translate-x-0',
    md: checked ? 'translate-x-5' : 'translate-x-0',
    lg: checked ? 'translate-x-6.5' : 'translate-x-0',
  };

  // Color styling maps
  const activeColorClasses: Record<ToggleColor, string> = {
    terracotta: 'bg-terracotta border-terracotta-border shadow-xs dark:bg-neon-orange dark:border-orange-500/80',
    teal: 'bg-teal-600 border-teal-500 shadow-xs dark:bg-neon-teal dark:border-teal-400 dark:shadow-[0_0_12px_rgba(20,184,166,0.5)]',
    purple: 'bg-purple-600 border-purple-500 shadow-xs dark:bg-purple-500 dark:border-purple-400',
    emerald: 'bg-emerald-600 border-emerald-500 shadow-xs dark:bg-emerald-500 dark:border-emerald-400',
    amber: 'bg-amber-500 border-amber-400 shadow-xs dark:bg-amber-500 dark:border-amber-400',
    blue: 'bg-blue-600 border-blue-500 shadow-xs dark:bg-blue-500 dark:border-blue-400',
    red: 'bg-red-600 border-red-500 shadow-xs dark:bg-red-500 dark:border-red-400',
  };

  const inactiveTrackClasses =
    'bg-cream-300 dark:bg-dark-surface border-warmgray-border dark:border-dark-border';

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        handleToggle();
      }}
    >
      {/* Optional Label (Left of switch when not reversed) */}
      {label && !reverse && (
        <div className="flex flex-col text-left">
          <span className="text-xs font-medium text-ink-900 dark:text-slate-100 font-mono leading-tight">
            {label}
          </span>
          {description && (
            <span className="text-[10px] text-ink-500 dark:text-slate-400 font-mono">
              {description}
            </span>
          )}
        </div>
      )}

      {/* Interactive Switch Container */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || (typeof label === 'string' ? label : 'Toggle switch')}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex items-center shrink-0 rounded-full border transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-terracotta/40 dark:focus:ring-neon-teal/50 focus:ring-offset-1 dark:focus:ring-offset-dark-bg ${
          trackSizeClasses[size]
        } ${checked ? activeColorClasses[activeColor] : inactiveTrackClasses}`}
      >
        {/* Track Micro-Icons (Background under thumb) */}
        {iconOn && iconOff && (
          <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none text-[10px]">
            <span
              className={`transition-opacity duration-200 ${
                checked ? 'opacity-100 text-white' : 'opacity-0'
              }`}
            >
              {iconOn}
            </span>
            <span
              className={`transition-opacity duration-200 ${
                !checked ? 'opacity-100 text-ink-400 dark:text-slate-500' : 'opacity-0'
              }`}
            >
              {iconOff}
            </span>
          </div>
        )}

        {/* Sliding Thumb Knob with fluid spring physics */}
        <span
          className={`pointer-events-none rounded-full bg-white dark:bg-slate-100 shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center justify-center text-ink-700 ${
            thumbSizeClasses[size]
          } ${thumbTranslateClasses[size]}`}
        >
          {/* Active Thumb Embedded Icon */}
          {checked
            ? iconOn && <span className="scale-75 text-ink-900">{iconOn}</span>
            : iconOff && <span className="scale-75 text-ink-400">{iconOff}</span>}
        </span>
      </button>

      {/* Optional Label (Right of switch when reversed) */}
      {label && reverse && (
        <div className="flex flex-col text-left">
          <span className="text-xs font-medium text-ink-900 dark:text-slate-100 font-mono leading-tight">
            {label}
          </span>
          {description && (
            <span className="text-[10px] text-ink-500 dark:text-slate-400 font-mono">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
