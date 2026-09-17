'use client';

// ==============================================================================
// THEME TOGGLE BUTTON: ACCESSIBLE LIGHT / DARK / SYSTEM MODE SWITCH
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme, ThemeMode } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'cycle' | 'dropdown';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
  variant = 'dropdown',
}) => {
  const { theme, resolvedTheme, setTheme, cycleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getIcon = () => {
    if (theme === 'system') {
      return <Laptop className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    }
    if (theme === 'dark') {
      return <Moon className="w-4 h-4 text-amber-400" />;
    }
    return <Sun className="w-4 h-4 text-amber-500" />;
  };

  const getLabel = () => {
    if (theme === 'system') return 'System';
    if (theme === 'dark') return 'Dark';
    return 'Light';
  };

  if (variant === 'cycle') {
    return (
      <button
        type="button"
        id="btn-global-theme-toggle"
        onClick={cycleTheme}
        aria-label={`Theme: ${getLabel()} (Click to cycle Light, Dark, System)`}
        title={`Theme: ${getLabel()} (Click to cycle Light, Dark, System)`}
        className={`relative inline-flex items-center justify-center p-2 rounded-full border transition-colors border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer ${className}`}
      >
        <div className="flex items-center gap-1.5">
          {getIcon()}
          {showLabel && <span className="text-xs select-none">{getLabel()}</span>}
        </div>
      </button>
    );
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        id="btn-global-theme-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Current theme: ${getLabel()}`}
        title={`Current theme: ${getLabel()} (Click to change)`}
        className={`relative inline-flex items-center justify-center p-2 rounded-full border transition-colors border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer ${className}`}
      >
        <div className="flex items-center gap-1.5">
          {getIcon()}
          {showLabel && <span className="text-xs select-none">{getLabel()}</span>}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            type="button"
            id="theme-opt-light"
            onClick={() => {
              setTheme('light');
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Light</span>
            </div>
            {theme === 'light' && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          </button>

          <button
            type="button"
            id="theme-opt-dark"
            onClick={() => {
              setTheme('dark');
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-amber-400" />
              <span>Dark</span>
            </div>
            {theme === 'dark' && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          </button>

          <button
            type="button"
            id="theme-opt-system"
            onClick={() => {
              setTheme('system');
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
              theme === 'system'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <Laptop className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>System</span>
            </div>
            {theme === 'system' && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          </button>
        </div>
      )}
    </div>
  );
};

