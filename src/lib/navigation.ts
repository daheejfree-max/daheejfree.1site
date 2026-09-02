// Safe browser-native router and search parameters hooks for Vite React SPA

export function navigateTo(url: string, replace = false) {
  if (typeof window === 'undefined') return;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (replace) {
      window.location.replace(url);
    } else {
      window.location.href = url;
    }
    return;
  }

  // Handle internal routing
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  const cleanPath = url.replace(/^\//, '').split('?')[0] || 'landing';
  if (replace) {
    window.history.replaceState({ tab: cleanPath }, '', cleanUrl);
  } else {
    window.history.pushState({ tab: cleanPath }, '', cleanUrl);
  }

  // Trigger popstate and app:navigate so App.tsx and other route listeners update instantly
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: cleanUrl, tab: cleanPath } }));
}

export function useRouter() {
  return {
    push: (url: string) => {
      navigateTo(url, false);
    },
    replace: (url: string) => {
      navigateTo(url, true);
    },
    back: () => {
      if (typeof window !== 'undefined') {
        window.history.back();
      }
    },
    forward: () => {
      if (typeof window !== 'undefined') {
        window.history.forward();
      }
    },
    refresh: () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:refresh'));
      }
    },
    prefetch: () => {},
  };
}

export function useSearchParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

export function usePathname() {
  if (typeof window === 'undefined') {
    return '/';
  }
  return window.location.pathname;
}

