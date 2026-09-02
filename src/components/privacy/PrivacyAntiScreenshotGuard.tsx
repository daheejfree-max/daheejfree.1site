'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Lock, EyeOff } from 'lucide-react';

interface PrivacyAntiScreenshotGuardProps {
  children?: React.ReactNode;
}

export const PrivacyAntiScreenshotGuard: React.FC<PrivacyAntiScreenshotGuardProps> = ({ children }) => {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
      } else {
        // Debounce unblur slightly to prevent rapid screenshot exploits
        setTimeout(() => setIsBlurred(false), 300);
      }
    };

    const handleWindowBlur = () => {
      setIsBlurred(true);
    };

    const handleWindowFocus = () => {
      setTimeout(() => setIsBlurred(false), 200);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  if (!children) {
    if (!isBlurred) return null;
    return (
      <div className="fixed inset-0 z-[99999] bg-zinc-950/90 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center text-white animate-fade-in select-none">
        <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center mb-4 shadow-xl shadow-emerald-950/50">
          <EyeOff className="w-8 h-8 text-emerald-400 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">
          Privacy Shield Activated
        </h2>
        <p className="text-sm text-zinc-400 max-w-sm">
          Content is shielded to protect confidential matrimonial profiles & prevent unauthorized screen capture.
        </p>
        <div className="mt-6 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-emerald-400">
          <Lock className="w-3.5 h-3.5" />
          <span>Islamic Haya & Confidentiality Standard</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[100dvh]">
      {/* Main Content with conditional blur filter */}
      <div
        className={`transition-all duration-200 ${
          isBlurred ? 'filter blur-2xl select-none pointer-events-none opacity-20' : ''
        }`}
      >
        {children}
      </div>

      {/* High-security Shield Overlay when window/app is backgrounded */}
      {isBlurred && (
        <div className="fixed inset-0 z-[99999] bg-zinc-950/90 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center text-white animate-fade-in select-none">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center mb-4 shadow-xl shadow-emerald-950/50">
            <EyeOff className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            Privacy Shield Activated
          </h2>
          <p className="text-sm text-zinc-400 max-w-sm">
            Content is shielded to protect confidential matrimonial profiles & prevent unauthorized screen capture.
          </p>
          <div className="mt-6 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-emerald-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Islamic Haya & Confidentiality Standard</span>
          </div>
        </div>
      )}
    </div>
  );
};
