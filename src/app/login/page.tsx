'use client';

// ==============================================================================
// STRICT LOGIN PAGE (SUPABASE AUTHENTICATION & ROUTE GUARDS)
// ==============================================================================

import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { Logo } from '../../components/brand/Logo';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { useRouter } from '../../hooks/useRouter';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { GoogleFastRegisterModal } from '../../components/auth/GoogleFastRegisterModal';
import { useAuth } from '../../hooks/useAuth';
import { updateLastKnownIp } from '../actions/security';

interface LoginPageProps {
  onSuccess?: (userId: string) => void;
  onNavigateSignup?: () => void;
}

export default function LoginPage({ onSuccess, onNavigateSignup }: LoginPageProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string; avatar_url: string } | null>(null);

  const { allProfiles, switchUser } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsEmailUnconfirmed(false);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both your registered email and password.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Call supabase.auth.signInWithPassword({ email, password })
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      // 2. Handle Errors strictly
      if (error) {
        setIsLoading(false);
        const errLower = error.message ? error.message.toLowerCase() : '';
        if (
          errLower.includes('email not confirmed') ||
          errLower.includes('email_not_confirmed') ||
          errLower.includes('unconfirmed')
        ) {
          setIsEmailUnconfirmed(true);
          setErrorMessage('Please check your email and click the confirmation link before logging in.');
          return;
        }

        console.error('[Login] Supabase signInWithPassword error:', error);
        setErrorMessage(error.message || 'Invalid email or password. Please try again.');
        return;
      }

      // 3. If Successful (data.session exists)
      if (data?.session) {
        const userId = data.user?.id;
        if (userId) {
          daheejStore.setCurrentUserId(userId);
          switchUser(userId);
          // Strict Security Audit: capture and log user IP to profiles table
          updateLastKnownIp(userId).catch((err) => console.warn('[Security] IP logging error:', err));
        }

        // Sync session cookie for server-side guards
        if (typeof document !== 'undefined') {
          document.cookie = `sb-access-token=${data.session.access_token}; Path=/; SameSite=None; Secure; Max-Age=604800`;
          document.cookie = `daheej_auth_session=${data.session.access_token}; Path=/; SameSite=None; Secure; Max-Age=604800`;
          document.cookie = `daheej_user_id=${userId || ''}; Path=/; SameSite=None; Secure; Max-Age=604800`;
          document.cookie = `daheej_is_onboarded=true; Path=/; SameSite=None; Secure; Max-Age=604800`;
          document.cookie = `daheej_has_avatar=true; Path=/; SameSite=None; Secure; Max-Age=604800`;
        }

        if (onSuccess && userId) {
          onSuccess(userId);
        } else {
          router.push('/matches');
        }
      } else {
        setIsLoading(false);
        setErrorMessage('Authentication session could not be established. Please try again.');
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during login.';
      if (msg.toLowerCase().includes('email not confirmed')) {
        setIsEmailUnconfirmed(true);
        setErrorMessage('Please check your email and click the confirmation link before logging in.');
      } else {
        setErrorMessage(msg);
      }
    }
  };

  const handleGoogleSuccess = async (userData: { name: string; email: string; avatar_url: string }) => {
    // Security Fix: Profile lookup and routing relies EXCLUSIVELY on authenticated user.id
    const { data: authData } = await supabase.auth.getUser();
    const authenticatedId = authData?.user?.id;

    if (authenticatedId) {
      daheejStore.setCurrentUserId(authenticatedId);
      switchUser(authenticatedId);
      router.refresh();
      if (onSuccess) onSuccess(authenticatedId);
      else router.push('/matches');
      return;
    }

    setGoogleUser(userData);
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-zinc-900 dark:text-zinc-100 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          Sign In to Your Matrimonial Portal
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Secure, Encrypted, and 100% Dowry-Free Islamic Matchmaking
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-8 px-6 sm:px-10 rounded-3xl shadow-xl dark:shadow-2xl space-y-6 transition-colors">
          {/* Strict Email Verification Banner */}
          {isEmailUnconfirmed && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span>Email Verification Required</span>
              </div>
              <p className="leading-relaxed">
                Please check your email and click the confirmation link before logging in.
              </p>
            </div>
          )}

          {/* Generic Error Banner */}
          {errorMessage && !isEmailUnconfirmed && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Google Sign-In Option */}
          <div className="space-y-4">
            <GoogleSignInButton mode="login" onGoogleSuccess={handleGoogleSuccess} />

            <div className="relative flex items-center justify-center">
              <div className="border-t border-zinc-200 dark:border-zinc-800 w-full" />
              <span className="bg-white dark:bg-zinc-900 px-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Or sign in with email
              </span>
            </div>
          </div>

          {/* Strict Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Registered Email / Wali Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  id="login-input-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. you@domain.com"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  id="login-input-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In Securely</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* New to DaheejFree */}
          <div className="text-center pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  if (onNavigateSignup) onNavigateSignup();
                  else router.push('/register');
                }}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Create an Account
              </button>
            </p>
          </div>

          {/* Google Fast Registration Modal */}
          <GoogleFastRegisterModal
            isOpen={Boolean(googleUser)}
            onClose={() => setGoogleUser(null)}
            googleUser={googleUser}
            onSuccess={(newUserId) => {
              switchUser(newUserId);
              router.refresh();
              if (onSuccess) onSuccess(newUserId);
              else router.push('/matches');
            }}
          />
        </div>
      </div>
    </div>
  );
}
