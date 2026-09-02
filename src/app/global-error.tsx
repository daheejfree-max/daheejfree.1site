'use client';

import React, { useEffect } from 'react';
import { AlertOctagon, RefreshCw, Home, ShieldAlert } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Root AppRouter Crash]:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center p-4 text-white font-sans antialiased">
        <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center space-y-6 shadow-2xl animate-fade-in pointer-events-auto">
          <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-950/50">
            <AlertOctagon className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Application Global Error</h1>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              A root layout level exception occurred. You can reset the application state or reload the portal.
            </p>
          </div>

          {error?.message && (
            <div className="p-3.5 rounded-2xl bg-black/70 border border-red-500/20 text-left overflow-hidden">
              <p className="text-[11px] font-mono text-red-300 break-all line-clamp-4">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-[9px] font-mono text-zinc-500 mt-1">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 hover:scale-105 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 pointer-events-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Application</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/';
                }
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 hover:scale-105 active:scale-95 text-zinc-300 text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
            >
              <Home className="w-4 h-4" />
              <span>Reload Home</span>
            </button>
          </div>

          <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500">
            <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
            <span>DaheejFree Root Protection Protocol</span>
          </div>
        </div>
      </body>
    </html>
  );
}
