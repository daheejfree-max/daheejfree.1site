// ==============================================================================
// SUPABASE BROWSER CLIENT & REACTIVE REALTIME BRIDGE
// ==============================================================================
import { createBrowserClient } from '@supabase/ssr';
import { daheejStore } from './store';

const supabaseUrl =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any as any).env?.VITE_SUPABASE_URL) ||
  '';

const supabaseAnonKey =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any as any).env?.VITE_SUPABASE_ANON_KEY) ||
  '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.warn('Notice: Supabase URL or Anon Key is missing or using placeholder values.');
}

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      sameSite: 'none',
      secure: true,
    },
  });
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: {
    sameSite: 'none',
    secure: true,
  },
});

export { daheejStore };
