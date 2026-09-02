'use client';

// ==============================================================================
// DAHEEJFREE BRAND LOGO (TRANSPARENT, DARK-NAVBAR OPTIMIZED, NO WHITE PILLS)
// ==============================================================================

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
  onClick,
}) => {
  const config = {
    sm: {
      container: 'w-7 h-7 rounded-lg',
      starSize: 'w-4 h-4',
      daheejText: 'text-base',
      freeText: 'text-base',
      subtitleText: 'text-[0.55rem] tracking-[0.25em]',
    },
    md: {
      container: 'w-9 h-9 rounded-xl',
      starSize: 'w-5 h-5',
      daheejText: 'text-xl',
      freeText: 'text-xl',
      subtitleText: 'text-[0.65rem] tracking-[0.3em]',
    },
    lg: {
      container: 'w-12 h-12 rounded-2xl',
      starSize: 'w-7 h-7',
      daheejText: 'text-3xl',
      freeText: 'text-3xl',
      subtitleText: 'text-[0.75rem] tracking-[0.35em]',
    },
  }[size];

  return (
    <div
      onClick={onClick}
      className={`bg-transparent flex items-center gap-2 select-none ${
        onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      } ${className}`}
      id="brand-logo-daheejfree"
    >
      {/* Icon: Soft green box with glowing emerald 5-pointed star */}
      <div
        className={`${config.container} bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.25)]`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`${config.starSize} text-emerald-400 fill-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]`}
        >
          <path d="M12 2.5l2.95 6.64 7.2.62-5.46 4.75 1.63 7.04L12 17.9l-6.32 3.65 1.63-7.04-5.46-4.75 7.2-.62L12 2.5z" />
        </svg>
      </div>

      {/* Text: Daheej (emerald), Free (amber), MATRIMONY (subtext) */}
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-baseline font-black tracking-tight">
          <span
            className={`${config.daheejText} font-extrabold text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]`}
          >
            Daheej
          </span>
          <span
            className={`${config.freeText} font-extrabold text-amber-500 dark:text-amber-400 ml-0.5 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]`}
          >
            Free
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`${config.subtitleText} font-bold text-zinc-500 dark:text-zinc-400 tracking-[0.3em] uppercase mt-0.5`}
          >
            MATRIMONY
          </span>
        )}
      </div>
    </div>
  );
};

export default Logo;
