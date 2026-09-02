'use client';

// ==============================================================================
// GOOGLE SIGN-IN & FAST REGISTRATION BUTTON COMPONENT
// ==============================================================================

import React, { useState } from 'react';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  '';

const supabaseAnonKey =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
  (typeof window !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  '';

// Instantiate PKCE-enforced Supabase SSR browser client
const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: {
    sameSite: 'none',
    secure: true,
  },
});

interface GoogleSignInButtonProps {
  mode?: 'login' | 'register';
  onGoogleSuccess?: (userData: { name: string; email: string; avatar_url: string }) => void;
  className?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  mode = 'register',
  onGoogleSuccess,
  className = '',
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleClick = async () => {
    setIsLoading(true);

    try {
      // Ensure Supabase client is instantiated strictly using createBrowserClient from @supabase/ssr
      const supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        cookieOptions: {
          sameSite: 'none',
          secure: true,
        },
      });
      
      const redirectUri =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/matches`
          : '';

      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('[GoogleSignInButton] Supabase signInWithOAuth raw error:', error);
        throw error;
      }

      if (data?.url && typeof window !== 'undefined') {
        window.location.href = data.url;
        return;
      }
    } catch (err: unknown) {
      console.error('[GoogleSignInButton] Supabase Google OAuth initialization failed:', err);
      const message = err instanceof Error ? err.message : 'Google authentication is currently unavailable.';
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        id={`btn-google-${mode}`}
        type="button"
        onClick={handleGoogleClick}
        disabled={isLoading}
        className="w-full relative flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/90 text-zinc-800 dark:text-zinc-100 font-bold text-xs border border-zinc-300 dark:border-zinc-700 shadow-sm dark:shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
      >
        {/* Google 4-Color SVG Logo */}
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>

        <span>
          {isLoading
            ? 'Connecting with Google Auth...'
            : mode === 'register'
            ? 'Sign in with Google (Fast Registration)'
            : 'Continue with Google'}
        </span>

        {mode === 'register' && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold border border-emerald-300 dark:border-emerald-700">
            <Sparkles className="w-2.5 h-2.5" />
            1-Click
          </span>
        )}
      </button>

      {mode === 'register' && (
        <p className="text-[11px] text-center text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Fast-tracks phone OTP & pre-fills verified credentials</span>
        </p>
      )}
    </div>
  );
};

export default GoogleSignInButton;
