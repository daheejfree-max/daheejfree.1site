import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);

  useEffect(() => {
    // Only evaluate dismissal on client
    if (typeof window === 'undefined') return;

    try {
      if (localStorage.getItem('pwa_installed') === 'true') {
        setDismissed(true);
        return;
      }

      const dismissTimestamp = localStorage.getItem('pwa_banner_dismissed_at');
      if (dismissTimestamp) {
        const timePassed = Date.now() - parseInt(dismissTimestamp, 10);
        // Don't show again if dismissed within last 7 days
        if (timePassed < 7 * 24 * 60 * 60 * 1000) {
          setDismissed(true);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Delay banner appearance slightly so it doesn't interrupt immediate initial load
    const timer = setTimeout(() => {
      // Re-verify installation state before showing
      try {
        if (localStorage.getItem('pwa_installed') === 'true') {
          return;
        }
      } catch {
        // ignore
      }
      setDismissed(false);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('pwa_banner_dismissed_at', Date.now().toString());
    } catch {
      // ignore
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setDismissed(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <div
        role="region"
        aria-label="App installation banner"
        className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-sm z-40 bg-zinc-900/95 text-white dark:bg-zinc-900/95 border border-emerald-500/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shrink-0 shadow-md">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-white truncate">Install DaheejFree App</p>
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-500 text-zinc-950 uppercase tracking-wider">
                App
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              Fast 1-tap access on home screen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Guide modal if direct prompt is not supported */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Install DaheejFree App</h3>
                  <p className="text-xs text-zinc-400">Save to your home screen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-300">
              <p>
                • <strong>iOS Safari:</strong> Tap Share icon (square with arrow) at bottom of browser &rarr; select <strong>Add to Home Screen</strong>.
              </p>
              <p>
                • <strong>Android Chrome:</strong> Tap three dots (⋮) menu &rarr; select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </p>
              <p>
                • <strong>Desktop:</strong> Click the install icon on the right side of the browser URL bar.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                handleDismiss();
              }}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-md cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
};
