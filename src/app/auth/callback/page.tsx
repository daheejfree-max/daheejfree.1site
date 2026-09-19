'use client';

// ==============================================================================
// CLIENT-SIDE AUTH CALLBACK PAGE (src/app/auth/callback/page.tsx)
// Handles Supabase PKCE Code Exchange, Session Provisioning & Fallbacks
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { daheejStore } from '../../../lib/supabase/store';
import { Profile } from '../../../types';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const next = url.searchParams.get('next') || '/matches';

        let activeUser: any = null;

        // 1. Check for query PKCE code (?code=...)
        if (code) {
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && data?.session) {
              activeUser = data.user || data.session.user;
              document.cookie = `sb-access-token=${data.session.access_token}; Path=/; SameSite=None; Secure; Max-Age=604800`;
              document.cookie = `daheej_auth_session=${data.session.access_token}; Path=/; SameSite=None; Secure; Max-Age=604800`;
              if (data.session.refresh_token) {
                document.cookie = `sb-refresh-token=${data.session.refresh_token}; Path=/; SameSite=None; Secure; Max-Age=604800`;
              }
            } else if (error) {
              console.warn('[AuthCallbackPage] Code exchange notice:', error.message);
            }
          } catch (codeErr) {
            console.warn('[AuthCallbackPage] Code exchange exception:', codeErr);
          }
        }

        // 2. Check for hash parameters (#access_token=...)
        if (!activeUser && window.location.hash && window.location.hash.includes('access_token')) {
          try {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken) {
              document.cookie = `sb-access-token=${accessToken}; Path=/; SameSite=None; Secure; Max-Age=604800`;
              document.cookie = `daheej_auth_session=${accessToken}; Path=/; SameSite=None; Secure; Max-Age=604800`;
              if (refreshToken) {
                document.cookie = `sb-refresh-token=${refreshToken}; Path=/; SameSite=None; Secure; Max-Age=604800`;
              }

              const { data: sessionData } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });

              activeUser = sessionData?.user;
            }
          } catch (hashErr) {
            console.warn('[AuthCallbackPage] Hash parsing exception:', hashErr);
          }
        }

        // 3. Fallback: check active session if already hydrated
        if (!activeUser) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            activeUser = sessionData.session.user;
          }
        }

        if (!activeUser) {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            activeUser = userData.user;
          }
        }

        if (activeUser) {
          const userId = activeUser.id;
          daheejStore.setCurrentUserId(userId);

          // Ensure profile exists in database and store
          try {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();

            if (existingProfile) {
              daheejStore.updateProfile(userId, existingProfile);
            } else {
              // Synthesize profile from Google OAuth user_metadata
              const meta = activeUser.user_metadata || {};
              const fullName = meta.full_name || meta.name || activeUser.email?.split('@')[0] || 'Member';
              const avatarUrl = meta.avatar_url || meta.picture || '';
              const gender = meta.gender || 'female';

              const newProfile: Profile = {
                id: userId,
                full_name: fullName,
                avatar_url: avatarUrl,
                gender: gender,
                age: Number(meta.age) || 24,
                profession: meta.profession || 'Professional',
                location: meta.location || 'Hyderabad, TS',
                wali_name: meta.wali_name || (gender === 'male' ? 'Candidate' : 'Guardian'),
                wali_phone: meta.wali_phone || meta.phone || '+91 98765 43210',
                wali_email: activeUser.email || '',
                anti_dowry_pledged: true,
                kyc_status: 'pending',
                kyc_verified: false,
                is_verified: false,
                is_onboarded: Boolean(meta.is_onboarded),
                subscription_tier: 'free',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              daheejStore.createProfile(newProfile);

              // Persist to remote database (non-blocking)
              try {
                await supabase
                  .from('profiles')
                  .upsert(newProfile, { onConflict: 'id', ignoreDuplicates: true });
              } catch (dbErr) {
                console.warn('[AuthCallback] Remote upsert notice:', dbErr);
              }
            }
          } catch (dbErr) {
            console.warn('[AuthCallback] Profile sync notice:', dbErr);
          }

          setStatus('success');
          // Navigate to target path
          window.location.href = next;
          return;
        }

        // If no user could be verified, try fallback from local store or redirect safely
        const localUid = daheejStore.getCurrentUserId();
        if (localUid) {
          setStatus('success');
          window.location.href = next;
          return;
        }

        setStatus('error');
        setErrorMsg('Authentication was not completed. Please try signing in again.');
      } catch (err: any) {
        console.error('[AuthCallbackPage] Error during callback processing:', err);
        setStatus('error');
        setErrorMsg(err?.message || 'Authentication failed');
      }
    }

    handleAuthCallback();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-xl max-w-sm w-full space-y-4">
        {status !== 'error' ? (
          <>
            <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              {status === 'processing' ? 'Completing Authentication...' : 'Redirecting to your feed...'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Please wait while we establish your secure Shariah-compliant session.
            </p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Authentication Notice</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{errorMsg || 'Could not verify session.'}</p>
            <button
              onClick={() => (window.location.href = '/login')}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
            >
              Return to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
