// ==============================================================================
// SUPABASE BROWSER CLIENT & REACTIVE REALTIME BRIDGE
// ==============================================================================
import { createBrowserClient } from '@supabase/ssr';
import { daheejStore } from './store';

const rawUrl =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any as any).env?.VITE_SUPABASE_URL) ||
  '';

const rawAnonKey =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any as any).env?.VITE_SUPABASE_ANON_KEY) ||
  '';

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawAnonKey &&
  !rawUrl.includes('your-project-id') &&
  !rawUrl.includes('placeholder')
);

// Fallback credentials prevent runtime crash when Supabase environment variables are pending setup
const safeUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder-project.supabase.co';
const safeAnonKey = isSupabaseConfigured ? rawAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder_anon_key';

export function createClient() {
  return createBrowserClient(safeUrl, safeAnonKey, {
    cookieOptions: {
      sameSite: 'none',
      secure: true,
    },
  });
}

export const supabase = createBrowserClient(safeUrl, safeAnonKey, {
  cookieOptions: {
    sameSite: 'none',
    secure: true,
  },
});

export { daheejStore };

