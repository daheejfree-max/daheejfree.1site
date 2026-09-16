// ==============================================================================
// SUPABASE BROWSER CLIENT & REACTIVE REALTIME BRIDGE
// ==============================================================================
import { createBrowserClient } from '@supabase/ssr';
import { daheejStore } from './store';

// Direct static references ensure Next.js SWC and Vite bundlers reliably inline environment variables
const rawUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  (typeof window !== 'undefined' && (window as any)?.__NEXT_DATA__?.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof window !== 'undefined' && (import.meta as any)?.env?.VITE_SUPABASE_URL) ||
  (typeof window !== 'undefined' && (import.meta as any)?.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  '';

const rawAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  (typeof window !== 'undefined' && (window as any)?.__NEXT_DATA__?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof window !== 'undefined' && (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof window !== 'undefined' && (import.meta as any)?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
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

