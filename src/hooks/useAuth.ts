// ==============================================================================
// AUTH & ACTIVE PROFILE HOOK (V3 STRICT COMPLIANT)
// ==============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Profile, Subscription, SubscriptionTier } from '../types';
import { daheejStore } from '../lib/supabase/store';
import { supabase } from '../lib/supabase/client';

export function useAuth() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string>(() => daheejStore.getCurrentUserId());
  const [profile, setProfile] = useState<Profile | null>(() => daheejStore.getProfileById(currentUserId));
  const [subscription, setSubscription] = useState<Subscription | null>(() =>
    daheejStore.getActiveSubscription(currentUserId)
  );
  const [allProfiles, setAllProfiles] = useState<Profile[]>(() => daheejStore.getProfiles());
  const isRefreshingRef = useRef<boolean>(false);

  const refreshState = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      // 1. Check live authenticated user session from Supabase
      const { data: authData } = await supabase.auth.getUser();
      const authenticatedId = authData?.user?.id;

      const uid = authenticatedId || daheejStore.getCurrentUserId() || '';
      setCurrentUserId(uid);

      if (!uid) {
        setProfile(null);
        setSubscription(null);
        setAllProfiles([]);
        return;
      }

      // 2. Fetch live profile from Supabase Database if online
      if (authenticatedId) {
        const { data: dbProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authenticatedId)
          .maybeSingle();

        if (profileErr) {
          console.warn('[Auth] Profile query warning (non-fatal):', profileErr.message);
        }

        if (dbProfile) {
          daheejStore.setProfileFromRemote(dbProfile);
          setProfile(dbProfile);
        } else {
          // If no database profile row exists yet, check local store or synthesize a provisional profile from auth metadata
          const existingLocal = daheejStore.getProfileById(authenticatedId);
          if (existingLocal) {
            setProfile(existingLocal);
          } else if (authData?.user) {
            const meta = authData.user.user_metadata || {};
            const provisionalProfile: Profile = {
              id: authenticatedId,
              full_name: meta.full_name || meta.name || 'New Member',
              gender: meta.gender || 'female',
              age: Number(meta.age) || 24,
              profession: meta.profession || 'Professional',
              location: meta.location || 'Hyderabad, TS',
              avatar_url: meta.avatar_url || meta.picture || '',
              wali_name: meta.wali_name || (meta.gender === 'male' ? 'Candidate' : 'Guardian'),
              wali_phone: meta.wali_phone || meta.phone || '',
              wali_email: authData.user.email || '',
              anti_dowry_pledged: true,
              kyc_status: 'verified',
              is_onboarded: Boolean(meta.is_onboarded),
              subscription_tier: 'free',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            daheejStore.createProfile(provisionalProfile);
            setProfile(provisionalProfile);
          } else {
            setProfile(daheejStore.getProfileById(uid));
          }
        }

        const { data: dbSub, error: subErr } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('profile_id', authenticatedId)
          .eq('status', 'active')
          .maybeSingle();

        if (subErr) {
          console.warn('[Auth] Subscription query warning (non-fatal):', subErr.message);
        }

        if (dbSub) {
          setSubscription(dbSub);
        } else {
          setSubscription(daheejStore.getActiveSubscription(uid));
        }
      } else {
        setProfile(daheejStore.getProfileById(uid));
        setSubscription(daheejStore.getActiveSubscription(uid));
      }

      setAllProfiles(daheejStore.getProfiles());
    } catch (err) {
      console.error('[Auth] Profile sync error:', err);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    refreshState().finally(() => setIsLoading(false));

    // Listen for live Supabase Auth state changes (e.g. OAuth sign-in)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.id) {
        daheejStore.setCurrentUserId(session.user.id);
      }
      refreshState();
    });

    // Subscribe to store updates only for user switch or subscription events
    const unsubscribe = daheejStore.subscribe((e) => {
      if (e.table === 'subscriptions' || (e.table === 'profiles' && e.new?.action === 'user_switch')) {
        refreshState();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
      unsubscribe();
    };
  }, [refreshState]);

  const switchUser = (userId: string) => {
    setIsLoading(true);
    daheejStore.setCurrentUserId(userId);
    refreshState().finally(() => setIsLoading(false));
  };

  const updateCurrentProfile = async (updates: Partial<Profile>) => {
    if (!profile) return null;
    const updated = daheejStore.updateProfile(profile.id, updates);
    setProfile((prev) => (prev ? { ...prev, ...updates } : (updated || null)));
    try {
      // Sanitize payload to only valid database columns
      const allowedKeys = new Set([
        'full_name', 'nickname', 'phone_number', 'gender', 'avatar_url',
        'wali_name', 'wali_relation', 'wali_phone', 'wali_contact_number', 'wali_email',
        'wali_verified', 'has_wali', 'kyc_status', 'kyc_verified', 'is_verified', 'id_verified', 'is_active',
        'subscription_tier', 'membership_tier', 'bio', 'age', 'profession',
        'location', 'education', 'sect', 'preferred_sect', 'religious_sect',
        'religious_practice', 'prayer_frequency', 'quran_recitation', 'marital_status',
        'has_children', 'height_cm', 'anti_dowry_pledged', 'dowry_pledge_signed',
        'islamic_oath_signed', 'islamic_oath_date', 'covenant_signed', 'covenant_signed_at',
        'is_onboarded', 'city', 'kyc_document_type', 'kyc_document_url', 'kyc_session_id', 'didit_session_id',
        'didit_session_url', 'subscription_id', 'subscription_status', 'photo_privacy',
        'is_photo_private', 'photo_blur_hash', 'photo_privacy_mode', 'selfie_verified',
        'selfie_url', 'selfie_verification_url', 'legal_consent_accepted_at',
        'terms_accepted', 'privacy_policy_accepted', 'icebreakers', 'last_known_ip', 'updated_at'
      ]);
      const cleanUpdates: Record<string, any> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (allowedKeys.has(k) && v !== undefined) {
          cleanUpdates[k] = v;
        }
      }
      cleanUpdates.updated_at = new Date().toISOString();
      await supabase.from('profiles').update(cleanUpdates).eq('id', profile.id);
    } catch (err) {
      console.error('[Auth] Supabase profile update error:', err);
    }
    refreshState();
    return updated;
  };

  const submitKYC = (documentType?: string, documentUrl?: string) => {
    if (!profile) return;
    updateCurrentProfile({
      kyc_status: 'verified',
      kyc_document_type: documentType,
      kyc_document_url: documentUrl,
    });
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    daheejStore.setCurrentUserId('');
    setCurrentUserId('');
    setProfile(null);
    setSubscription(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('daheejfree_current_user_id');
        sessionStorage.clear();
      } catch {
        // Ignore
      }
    }
    setIsLoading(false);
  };

  const tier: SubscriptionTier = subscription?.tier || profile?.subscription_tier || 'free';
  const isDiamond = tier === 'diamond';
  const isVerified = profile?.kyc_status === 'verified';

  return {
    user: profile ? { id: profile.id, email: `${profile.id}@daheejfree.org` } : null,
    profile,
    subscription,
    tier,
    isDiamond,
    isVerified,
    allProfiles,
    isLoading,
    switchUser,
    signOut,
    updateCurrentProfile,
    submitKYC,
    refreshState,
  };
}

