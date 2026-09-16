'use client';

// ==============================================================================
// ONBOARDING & LEGAL CONSENT GUARD (src/components/auth/OnboardingGuard.tsx)
// Enforces mandatory legal agreements (Terms, Privacy, Anti-Dowry Pledge)
// for all authenticated users including Google OAuth accounts.
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Profile } from '../../types';
import { daheejStore } from '../../lib/supabase/store';

interface OnboardingGuardProps {
  children?: React.ReactNode;
  currentUserId: string | null;
  currentProfile: Profile | null;
  currentTab: string;
  onRedirectToOnboarding: () => void;
  onProfileUpdated?: (updated: Partial<Profile>) => void;
}

/**
 * Checks if a profile has accepted all required legal agreements:
 * 1. terms_accepted === true
 * 2. privacy_policy_accepted === true (or privacy_accepted === true)
 * 3. anti_dowry_pledged === true (or anti_dowry_pledge === true)
 */
export function hasAcceptedLegalConsent(profile: Profile | null): boolean {
  if (!profile) return false;
  const termsOk = Boolean(profile.terms_accepted);
  const privacyOk = Boolean(profile.privacy_policy_accepted || profile.privacy_accepted);
  const dowryOk = Boolean(profile.anti_dowry_pledged || profile.anti_dowry_pledge);
  return termsOk && privacyOk && dowryOk;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({
  children,
  currentUserId,
  currentProfile,
  currentTab,
  onRedirectToOnboarding,
  onProfileUpdated,
}) => {
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  useEffect(() => {
    if (!currentUserId) return;

    let isMounted = true;

    async function checkLegalConsent() {
      setIsVerifying(true);
      try {
        // Query public.profiles directly on mount for current user record
        const { data, error } = await supabase
          .from('profiles')
          .select('id, terms_accepted, privacy_policy_accepted, privacy_accepted, anti_dowry_pledged, anti_dowry_pledge, is_onboarded')
          .eq('id', currentUserId)
          .maybeSingle();

        if (isMounted) {
          if (data && !error) {
            const hasConsent =
              Boolean(data.terms_accepted) &&
              Boolean(data.privacy_policy_accepted || data.privacy_accepted) &&
              Boolean(data.anti_dowry_pledged || data.anti_dowry_pledge);

            if (!hasConsent && currentTab !== 'onboarding' && currentTab !== 'auth-callback' && currentTab !== 'reset-password') {
              onRedirectToOnboarding();
            }

            if (onProfileUpdated) {
              onProfileUpdated(data as Partial<Profile>);
            }
          } else if (currentProfile) {
            const hasConsent = hasAcceptedLegalConsent(currentProfile);
            if (!hasConsent && currentTab !== 'onboarding' && currentTab !== 'auth-callback' && currentTab !== 'reset-password') {
              onRedirectToOnboarding();
            }
          }
        }
      } catch (err) {
        console.warn('[OnboardingGuard] Verification notice:', err);
        if (currentProfile && !hasAcceptedLegalConsent(currentProfile)) {
          if (currentTab !== 'onboarding' && currentTab !== 'auth-callback') {
            onRedirectToOnboarding();
          }
        }
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    }

    checkLegalConsent();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, currentTab, onRedirectToOnboarding, currentProfile, onProfileUpdated]);

  return <>{children}</>;
};
