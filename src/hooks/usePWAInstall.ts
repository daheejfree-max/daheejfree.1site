import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function checkIsAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Check if running in standalone display mode (installed PWA window)
  const isStandaloneDisplay =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches;

  if (isStandaloneDisplay) return true;

  // 2. Check iOS Safari standalone property
  if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) {
    return true;
  }

  // 3. Check Android TWA referrer
  if (document.referrer && document.referrer.includes('android-app://')) {
    return true;
  }

  // 4. Check persistent storage (saved when previously installed on this device/browser)
  try {
    if (localStorage.getItem('pwa_installed') === 'true') {
      return true;
    }
  } catch {
    // ignore security / storage restrictions
  }

  return false;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsAppInstalled());
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Initial check
    const installed = checkIsAppInstalled();
    if (installed) {
      setIsInstalled(true);
    }

    // Modern Chromium getInstalledRelatedApps API
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as unknown as { getInstalledRelatedApps: () => Promise<unknown[]> })
        .getInstalledRelatedApps()
        .then((relatedApps) => {
          if (Array.isArray(relatedApps) && relatedApps.length > 0) {
            setIsInstalled(true);
            try {
              localStorage.setItem('pwa_installed', 'true');
            } catch {
              // ignore
            }
          }
        })
        .catch(() => {
          // quiet
        });
    }

    // Listen for display mode changes (e.g. if opened or switched to standalone)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        try {
          localStorage.setItem('pwa_installed', 'true');
        } catch {
          // ignore
        }
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayChange);
    }

    // Capture Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // If already verified as running installed, avoid capturing
      if (checkIsAppInstalled()) {
        return;
      }
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // When the user completes the installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      try {
        localStorage.setItem('pwa_installed', 'true');
      } catch {
        // quiet
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        try {
          localStorage.setItem('pwa_installed', 'true');
        } catch {
          // ignore
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Installation prompt notice:', err);
      return false;
    }
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}
