import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center gap-2.5 rounded-2xl bg-zinc-900/95 border border-amber-500/40 px-4 py-2.5 text-xs font-semibold text-amber-300 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 transition-all max-w-sm"
    >
      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
        <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-zinc-100">Offline Mode</p>
        <p className="text-[11px] text-zinc-400 truncate">Cached profile data is being served.</p>
      </div>
    </div>
  );
};
