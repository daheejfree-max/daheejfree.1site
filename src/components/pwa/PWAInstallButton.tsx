import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  X,
  CheckCircle2,
  Sparkles,
  Monitor,
  MoreVertical,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'menu' | 'hero' | 'compact' | 'badge';
  className?: string;
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  className = '',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [, setInstalling] = useState<boolean>(false);

  // If already running inside installed standalone PWA or app is installed, suppress all install triggers
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      const success = await install();
      setInstalling(false);
      if (success && onInstalled) {
        onInstalled();
      }
    } else {
      // Browser didn't trigger prompt yet or iOS/desktop manual instructions needed
      setShowGuideModal(true);
    }
  };

  // Determine user platform for customized instructions
  const isMobile =
    typeof navigator !== 'undefined' &&
    (/android|iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  return (
    <>
      {/* 1. Navbar Compact Variant */}
      {variant === 'navbar' && (
        <button
          type="button"
          id="btn-pwa-install-navbar"
          onClick={handleInstallClick}
          title="Install DaheejFree as a standalone app"
          aria-label="Install App"
          className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 active:scale-95 ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline font-bold">Install App</span>
          <span className="sm:hidden font-bold text-[11px]">Install</span>
        </button>
      )}

      {/* 2. Menu Variant (Used inside UserMenu / Mobile Drawer) */}
      {variant === 'menu' && (
        <button
          type="button"
          id="btn-pwa-install-menu"
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between py-3 md:py-2.5 px-4 rounded-xl text-left text-sm md:text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 md:w-4 md:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-left">
              <p className="font-bold leading-tight">Install DaheejFree App</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                Add to Home Screen for fast 1-tap access & offline alerts
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-xs">
            Free
          </span>
        </button>
      )}

      {/* 3. Hero / Prominent CTA Variant */}
      {variant === 'hero' && (
        <button
          type="button"
          id="btn-pwa-install-hero"
          onClick={handleInstallClick}
          className={`min-h-[48px] px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/20 active:scale-98 transition-all cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4 text-emerald-100" />
          <span>Install DaheejFree App</span>
          <span className="text-[10px] font-medium bg-emerald-700/80 px-2 py-0.5 rounded-full text-emerald-100">
            PWA
          </span>
        </button>
      )}

      {/* 4. Compact Variant */}
      {variant === 'compact' && (
        <button
          type="button"
          id="btn-pwa-install-compact"
          onClick={handleInstallClick}
          className={`h-8 w-8 min-h-[36px] min-w-[36px] rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer flex items-center justify-center ${className}`}
          title="Install App as Native Application"
          aria-label="Install App"
        >
          <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </button>
      )}

      {/* 5. Subtle Badge Variant */}
      {variant === 'badge' && (
        <button
          type="button"
          id="btn-pwa-install-badge"
          onClick={handleInstallClick}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white shadow-xs hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      )}

      {/* Cross-Platform Step-by-Step Installation Instructions Modal */}
      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  {isMobile ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Install DaheejFree App
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Fast 1-tap launch & privacy-first matrimonial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step-by-Step Instructions based on OS */}
            {isIOS ? (
              /* iOS Safari Instructions */
              <div className="space-y-3 pt-1 text-xs text-zinc-700 dark:text-zinc-300">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>Tap the Safari Share Button</span>
                      <Share className="w-3.5 h-3.5 text-blue-500" />
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                      At the bottom bar of your Safari browser, tap the Share icon (square with upward arrow).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>Tap "Add to Home Screen"</span>
                      <PlusSquare className="w-3.5 h-3.5 text-emerald-500" />
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                      Scroll down the list and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong> at top right.
                    </p>
                  </div>
                </div>
              </div>
            ) : isMobile ? (
              /* Android / Mobile Browser Instructions */
              <div className="space-y-3 pt-1 text-xs text-zinc-700 dark:text-zinc-300">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>Tap Browser Menu (⋮)</span>
                      <MoreVertical className="w-3.5 h-3.5 text-zinc-400" />
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                      Tap the three dots in the top or bottom right corner of Chrome or your browser.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>Select "Install App" or "Add to Home"</span>
                      <Download className="w-3.5 h-3.5 text-emerald-500" />
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                      Tap <strong>Install application</strong> or <strong>Add to Home screen</strong>. The DaheejFree icon will appear on your phone.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Desktop (Chrome / Edge / Safari / Brave) Instructions */
              <div className="space-y-3 pt-1 text-xs text-zinc-700 dark:text-zinc-300">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>Click Install in Address Bar</span>
                      <Download className="w-3.5 h-3.5 text-emerald-500" />
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                      Look for the install computer/download icon on the right side of your browser URL bar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-zinc-900 dark:text-white">Or via Browser Menu</p>
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                      Click the three dots menu (⋮) in Chrome/Edge and select <strong>Install DaheejFree Matrimonial</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PWA Benefits */}
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Enjoy fullscreen view, offline profile browsing, faster loading, and instant notification alerts.
              </p>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm transition-colors shadow-md cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
