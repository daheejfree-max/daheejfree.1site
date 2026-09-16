// ==============================================================================
// SUPABASE SSR SERVER CLIENT & ADMIN SERVICE ROLE CLIENT
// ==============================================================================

import { createServerClient } from '@supabase/ssr';
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
 * Creates a server-side Supabase client with cookie handlers for Next.js 15 App Router / Server Actions
 */
export async function createClient(cookieStore?: any) {
  const resolvedStore = cookieStore && typeof cookieStore.then === 'function' ? await cookieStore : cookieStore;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      sameSite: 'none',
      secure: true,
    },
    cookies: {
      getAll() {
        if (!resolvedStore) return [];
        if (typeof resolvedStore.getAll === 'function') {
          return resolvedStore.getAll();
        }
        return [];
      },
      setAll(cookiesToSet) {
        if (!resolvedStore) return;
        try {
          if (typeof resolvedStore.set === 'function') {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              resolvedStore.set(name, value, {
                ...options,
                sameSite: 'none',
                secure: true,
              })
            );
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
 * Bypasses RLS for secure admin actions, webhook fulfillment, and background system jobs
 */
export function createAdminClient() {
  if (!supabaseServiceRoleKey) {
    console.warn('[createAdminClient] SUPABASE_SERVICE_ROLE_KEY is not defined. Falling back to anon key; RLS bypass will be inactive.');
  }
  const keyToUse = supabaseServiceRoleKey || supabaseAnonKey;
  return createSupabaseClient(supabaseUrl, keyToUse, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
