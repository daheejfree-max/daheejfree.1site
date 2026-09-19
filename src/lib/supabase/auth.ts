// ==============================================================================
// SUPABASE AUTHENTICATION SERVICE (GOOGLE OAUTH & FAST REGISTRATION FLOW)
// ==============================================================================

import { supabase, daheejStore } from './client';
import { Profile, Gender } from '../../types/database';

export interface GoogleAuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface GoogleFastRegisterData {
  name: string;
  email: string;
  avatar_url?: string;
  gender: Gender;
  age: number;
  location: string;
  profession: string;
  waliName: string;
  waliRelation: string;
  waliPhone: string;
  waliEmail?: string;
  antiDowryPledge: boolean;
  legalConsentAcceptedAt?: string;
}

/**
 * Initiates Supabase Google OAuth sign-in / registration
 */
export async function signInWithGoogleSupabase(nextRoute: string = '/matches'): Promise<{ url?: string; error?: string }> {
  try {
    const redirectUri =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextRoute)}`
        : '';
    const { data, error } = await supabase.auth.signInWithOAuth({
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
      return { error: error.message };
    }

    return { url: data.url };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Google OAuth initialization failed';
    return { error: msg };
  }
}

/**
 * Captures user IP from Vercel/proxy headers via secure server endpoint and persists to Supabase
 */
export async function logUserIpAddress(userId: string): Promise<string> {
  if (!userId) return 'Unknown';
  try {
    const res = await fetch('/api/auth/log-ip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (data?.ip) return data.ip;
  } catch (err) {
    console.warn('[Security] IP log request notice:', err);
  }
  return 'Unknown';
}

/**
 * Email & Password sign-in using Supabase Auth
 */
export async function signInWithEmailSupabase(
  email: string,
  password: string
): Promise<{ success: boolean; profile?: Profile; isEmailUnconfirmed?: boolean; error?: string }> {
  try {
    // Attempt Supabase Auth signInWithPassword
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 1. Strict Email Verification check
      const errMsg = error.message || '';
      if (
        errMsg.toLowerCase().includes('email not confirmed') ||
        errMsg.toLowerCase().includes('email_not_confirmed') ||
        errMsg.toLowerCase().includes('unconfirmed')
      ) {
        return {
          success: false,
          isEmailUnconfirmed: true,
          error: 'Your email has not been verified. Please check your inbox for the verification link.',
        };
      }

      return { success: false, error: error.message };
    }

    if (data.user) {
      // Check if user email is confirmed in user metadata
      if (data.user.email_confirmed_at === null && (data.user as any as any).confirmed_at === null && !data.session) {
        return {
          success: false,
          isEmailUnconfirmed: true,
          error: 'Your email has not been verified. Please check your inbox for the verification link.',
        };
      }

      // Capture and update last_known_ip securely
      logUserIpAddress(data.user.id);

      // Look up user profile exclusively by user.id
      let profile = daheejStore.getProfileById(data.user.id);
      if (!profile) {
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (dbProfile) {
          daheejStore.updateProfile(dbProfile.id, dbProfile);
          profile = dbProfile;
        }
      }

      if (profile) {
        daheejStore.setCurrentUserId(profile.id);
        return { success: true, profile };
      }

      // If user is authenticated in Supabase but profile row hasn't been created yet, synthesize by user.id
      const meta = data.user.user_metadata || {};
      const newProfile: Profile = {
        id: data.user.id,
        full_name: meta.full_name || meta.name || data.user.email?.split('@')[0] || 'Member',
        gender: meta.gender || 'female',
        age: Number(meta.age) || 24,
        profession: meta.profession || 'Professional',
        location: meta.location || 'Hyderabad, TS',
        avatar_url: meta.avatar_url || meta.picture || '',
        wali_name: meta.wali_name || 'Guardian',
        wali_phone: meta.wali_phone || meta.phone || '',
        wali_email: data.user.email || '',
        anti_dowry_pledged: true,
        kyc_status: 'pending',
        is_onboarded: Boolean(meta.is_onboarded),
        subscription_tier: 'free',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      daheejStore.createProfile(newProfile);
      daheejStore.setCurrentUserId(newProfile.id);
      return { success: true, profile: newProfile };
    }

    return { success: false, error: 'Authentication session could not be established.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    if (msg.toLowerCase().includes('email not confirmed')) {
      return {
        success: false,
        isEmailUnconfirmed: true,
        error: 'Your email has not been verified. Please check your inbox for the verification link.',
      };
    }
    return { success: false, error: msg };
  }
}

/**
 * Email & Password sign-up using Supabase Auth with Profile provisioning
 */
export async function signUpWithEmailSupabase(
  data: GoogleFastRegisterData & { password?: string }
): Promise<{
  success: boolean;
  needsEmailVerification?: boolean;
  profile?: Profile;
  message?: string;
  error?: string;
}> {
  try {
    if (!data.antiDowryPledge) {
      return { success: false, error: 'Anti-Dowry (Bila-Daheej) Shariah Charter agreement is required.' };
    }

    // Call supabase.auth.signUp
    if (data.password) {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.name,
            gender: data.gender,
            role: 'candidate',
          },
        },
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      // If Supabase created user but no session is returned -> Email Confirmation required
      if (authData?.user && !authData?.session) {
        return {
          success: true,
          needsEmailVerification: true,
          message: 'Registration successful! Please check your email to verify your account before logging in.',
        };
      }
    }

    const userId = `usr_${data.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 10)}_${Date.now().toString().slice(-4)}`;
    const newProfile: Profile = {
      id: userId,
      phone_number: data.waliPhone || '+91 98765 43210',
      full_name: data.name,
      gender: data.gender,
      age: Number(data.age) || 25,
      avatar_url:
        data.avatar_url ||
        (data.gender === 'female'
          ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80'),
      bio: `Assalamu Alaikum. Seeking pious, dowry-free Nikah based on Quran and Sunnah. All communications supervised by Wali.`,
      location: data.location || 'Hyderabad, TS',
      profession: data.profession || 'Working Professional',
      education: 'Bachelor Degree',
      religious_sect: 'Sunni',
      marital_status: 'Never Married',
      has_children: false,
      height_cm: data.gender === 'female' ? 165 : 178,
      anti_dowry_pledged: true,
      kyc_status: 'pending',
      kyc_verified: false,
      is_verified: false,
      wali_name: data.waliName || 'Mohammed Ali',
      wali_relation: data.waliRelation || 'Father',
      wali_phone: data.waliPhone || '+91 98765 43210',
      wali_email: data.waliEmail || data.email,
      legal_consent_accepted_at: data.legalConsentAcceptedAt || new Date().toISOString(),
      terms_accepted: true,
      privacy_policy_accepted: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subscription_tier: 'free',
    };

    daheejStore.createProfile(newProfile);
    daheejStore.setCurrentUserId(newProfile.id);
    logUserIpAddress(newProfile.id);

    return { success: true, profile: newProfile };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return { success: false, error: msg };
  }
}

export async function registerWithGoogleFastTrack(
  data: GoogleFastRegisterData
): Promise<{ success: boolean; profile?: Profile; error?: string }> {
  return signUpWithEmailSupabase(data);
}

/**
 * Hardened sign out: Destroys Supabase session, wipes local storage, invalidates cookies, and clears phantom state with hard redirect
 */
export async function signOutSupabase(options?: { hardRedirect?: boolean }): Promise<{ error?: string }> {
  try {
    // 1. Supabase Client Sign Out with local scope
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      await supabase.auth.signOut().catch(() => {});
    }

    // 2. Clear LocalStorage and SessionStorage completely
    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
        sessionStorage.clear();

        // Expire authentication cookies
        const cookiesToClear = [
          'sb-access-token',
          'sb-refresh-token',
          'supabase-auth-token',
          'daheej_auth_session',
          'daheej_user_id',
          'daheej_is_onboarded',
          'daheej_has_avatar',
          'daheej_kyc_status',
        ];
        cookiesToClear.forEach((cookieName) => {
          document.cookie = `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=None; Secure`;
        });
      } catch (storageErr) {
        console.warn('[Auth] Storage clearance notice:', storageErr);
      }

      // 3. Force hard browser navigation to clear React memory
      if (options?.hardRedirect !== false) {
        window.location.href = '/login';
      }
    }

    return {};
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sign out error';
    return { error: msg };
  }
}
