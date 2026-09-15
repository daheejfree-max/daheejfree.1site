// Safe headers & cookies stub for Next.js App Router compatibility in Vite/Express

export function cookies() {
  return {
    get(name: string) {
      if (typeof document === 'undefined') return undefined;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return { name, value: parts.pop()?.split(';').shift() || '' };
      }
      return undefined;
    },
    getAll() {
      if (typeof document === 'undefined') return [];
      return document.cookie
        .split('; ')
        .filter(Boolean)
        .map((cookie) => {
          const [name, ...rest] = cookie.split('=');
          return { name, value: rest.join('=') };
        });
    },
    set(_name: string, _value: string, _options?: any) {},
    delete(_name: string) {},
  };
}

export function headers() {
  return typeof Headers !== 'undefined' ? new Headers() : new Map();
}
