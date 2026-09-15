'use client';

import React from 'react';
import { Eye } from 'lucide-react';

interface WatermarkedImageProps {
  src: string | null;
  alt: string;
  viewerId?: string;
  isUnlocked: boolean;
  blurMessage?: string;
  className?: string;
  aspectRatio?: string;
  fallbackInitial?: string;
}

export const WatermarkedImage: React.FC<WatermarkedImageProps> = ({
  src,
  alt,
  viewerId = 'GUEST_USER',
  isUnlocked,
  blurMessage = 'Private Photo',
  className = 'w-full h-full object-cover',
  aspectRatio = 'aspect-square',
  fallbackInitial,
}) => {
  const shortViewerId = viewerId.length > 8 ? viewerId.substring(0, 8).toUpperCase() : viewerId.toUpperCase();
  const dateStamp = new Date().toISOString().split('T')[0];
  const initial = (fallbackInitial || alt || 'M').trim().charAt(0).toUpperCase();

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none select-text-none ${aspectRatio}`}
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* 1. Underlying image with continuous smooth unblur transition (blur-2xl -> blur-none) */}
      {src ? (
        <>
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            draggable={false}
            className={`${className} transition-all duration-700 ease-out pointer-events-none ${
              isUnlocked ? 'blur-none scale-100 opacity-100' : 'blur-2xl scale-110 opacity-40'
            }`}
            style={{
              WebkitTouchCallout: 'none',
              pointerEvents: 'none',
            }}
          />

          {/* Dynamic Traceable Forensic Watermark Overlay (fades in on unblur) */}
          <div
            className={`absolute inset-0 pointer-events-none flex flex-col justify-around p-2 select-none overflow-hidden transition-opacity duration-700 ${
              isUnlocked ? 'opacity-30' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 40px,
                rgba(255, 255, 255, 0.08) 40px,
                rgba(255, 255, 255, 0.08) 80px
              )`,
            }}
          >
            <div className="transform -rotate-12 text-[9px] font-mono font-bold tracking-widest text-emerald-800 dark:text-white uppercase text-center drop-shadow-sm select-none">
              DAHEEJFREE • VIEWER: {shortViewerId} • {dateStamp}
            </div>
            <div className="transform -rotate-12 text-[8px] font-mono font-semibold tracking-wider text-emerald-800 dark:text-white uppercase text-center drop-shadow-sm select-none">
              DO NOT SCREENSHOT • CONFIDENTIAL NIKAH
            </div>
            <div className="transform -rotate-12 text-[9px] font-mono font-bold tracking-widest text-emerald-800 dark:text-white uppercase text-center drop-shadow-sm select-none">
              TRACEABLE ID: {shortViewerId}
            </div>
          </div>

          {/* Sleek Privacy Lock Overlay (smoothly fades out on unlock) */}
          <div
            className={`absolute inset-0 bg-neutral-900/60 backdrop-blur-xs border border-neutral-800 flex flex-col items-center justify-center p-2 text-center transition-all duration-700 ease-out ${
              isUnlocked ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'
            }`}
          >
            <div className="relative w-9 h-9 rounded-full bg-neutral-800/90 border border-neutral-700/80 flex items-center justify-center mb-1.5 shadow-sm text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <span className="relative text-[11px] font-bold text-neutral-200 leading-tight">
              {blurMessage || 'Private Photo'}
            </span>
            {!blurMessage?.toLowerCase().includes('consent') && (
              <span className="relative text-[9px] font-medium text-emerald-400 mt-1 leading-none">
                Consent Required
              </span>
            )}
          </div>
        </>
      ) : (
        /* Fallback when no photo exists */
        <div className="w-full h-full bg-neutral-900/90 border border-neutral-800 flex flex-col items-center justify-center p-2 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
          <span className="text-3xl font-bold text-neutral-300 select-none">
            {initial}
          </span>
        </div>
      )}

      {/* Transparent touch-blocker shield on top to prevent mobile long-press image saving */}
      <div
        className="absolute inset-0 bg-transparent cursor-default"
        style={{
          WebkitTouchCallout: 'none',
          userSelect: 'none',
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          return false;
        }}
      />
    </div>
  );
};
