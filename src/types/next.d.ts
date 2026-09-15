// Type definitions for Next.js App Router compatibility in Vite/TypeScript workspace

declare module 'next/navigation' {
  export function redirect(url: string): never;
  export function useRouter(): {
    push: (url: string) => void;
    replace: (url: string) => void;
    refresh: () => void;
    back: () => void;
    forward: () => void;
  };
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
}

declare module 'next/headers' {
  export function cookies(): {
    get: (name: string) => { name: string; value: string } | undefined;
    getAll: () => Array<{ name: string; value: string }>;
    set: (name: string, value: string, options?: any) => void;
    delete: (name: string) => void;
  };
  export function headers(): Headers;
}

declare module 'next/server' {
  export class NextResponse extends Response {
    static json(body: any, init?: ResponseInit): Response;
    static redirect(url: string | URL, status?: number): Response;
    static next(): Response;
  }
}
