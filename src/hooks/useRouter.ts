// ==============================================================================
// NEXT.JS / REACT COMPATIBLE ROUTER HOOK
// ==============================================================================

import { useCallback } from 'react';

export function useRouter() {
  const push = useCallback((url: string) => {
    if (typeof window === 'undefined') return;
    const cleanPath = url.replace(/^\//, '').split('?')[0] || 'landing';
    window.history.pushState({ tab: cleanPath }, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: url, tab: cleanPath } }));
  }, []);

  const replace = useCallback((url: string) => {
    if (typeof window === 'undefined') return;
    const cleanPath = url.replace(/^\//, '').split('?')[0] || 'landing';
    window.history.replaceState({ tab: cleanPath }, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: url, tab: cleanPath } }));
  }, []);

  const refresh = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('app:refresh'));
  }, []);

  const back = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.history.back();
  }, []);

  return { push, replace, refresh, back };
}

export default useRouter;
