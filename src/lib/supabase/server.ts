// ==============================================================================
// SUPABASE SSR SERVER CLIENT & ADMIN SERVICE ROLE CLIENT
// ==============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.error('CRITICAL: Supabase URL or Anon Key is missing or using placeholder values.');
}

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  '';

/**
 * Creates a server-side Supabase client with cookie handlers for Next.js 15 App Router / Express
 */
export async function createClient(cookieStore?: {
  get?: (name: string) => { value?: string } | string | undefined;
  set?: (name: string, value: string, options?: CookieOptions) => void;
  remove?: (name: string, options?: CookieOptions) => void;
  delete?: (name: string, options?: CookieOptions) => void;
  getAll?: () => Array<{ name: string; value: string }>;
} | Promise<any>) {
  const resolvedStore = cookieStore && typeof (cookieStore as any as any).then === 'function' ? await cookieStore : cookieStore;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      sameSite: 'none',
      secure: true,
    },
    cookies: {
      get(name: string) {
        if (!resolvedStore) return undefined;
        const cookie = typeof resolvedStore.get === 'function' ? resolvedStore.get(name) : undefined;
        if (typeof cookie === 'string') return cookie;
        return cookie?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        if (!resolvedStore) return;
        try {
          if (typeof resolvedStore.set === 'function') {
            resolvedStore.set(name, value, {
              ...options,
              sameSite: 'none',
              secure: true,
            });
          }
        } catch {
          // Handled for Server Components where cookies are read-only
        }
      },
      remove(name: string, options: CookieOptions) {
        if (!resolvedStore) return;
        try {
          if (typeof resolvedStore.delete === 'function') {
            resolvedStore.delete(name, { ...options, sameSite: 'none', secure: true });
          } else if (typeof resolvedStore.remove === 'function') {
            resolvedStore.remove(name, { ...options, sameSite: 'none', secure: true });
          } else if (typeof resolvedStore.set === 'function') {
            resolvedStore.set(name, '', { ...options, maxAge: 0, sameSite: 'none', secure: true });
          }
        } catch {
          // Handled for Server Components where cookies are read-only
        }
      },
    },
  });
}

/**
 * Creates an elevated Supabase Admin client using SUPABASE_SERVICE_ROLE_KEY
 * Bypasses RLS for secure webhook fulfillment and background system jobs
 */
export function createAdminClient() {
  const keyToUse = supabaseServiceRoleKey || supabaseAnonKey;
  return createSupabaseClient(supabaseUrl, keyToUse, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
