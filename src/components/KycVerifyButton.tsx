'use client';

// ==============================================================================
// DIDIT KYC VERIFY BUTTON CLIENT COMPONENT
// File: src/components/KycVerifyButton.tsx
// Triggers the Didit KYC session creation flow:
// 1. Fetches a new KYC session URL from /api/kyc/create-session passing
//    the current user's Supabase user.id in vendorData, reference, and customerId fields.
// 2. Redirects the user to the returned Didit session URL.
// CRITICAL DIRECTIVE: Preserves all Tailwind CSS layout, styling, and classes.
// Only implements the onClick functionality and backend coordination.
// ==============================================================================

import React, { useState, useCallback } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase/client';

export interface KycVerifyButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onError'> {
  userId?: string;
  profileId?: string;
  callbackUrl?: string;
  className?: string;
  children?: React.ReactNode;
  onBeforeRedirect?: () => void;
  onError?: (error: string) => void;
  onSuccessUrl?: (url: string) => void;
}

export const KycVerifyButton: React.FC<KycVerifyButtonProps> = ({
  userId,
  profileId,
  callbackUrl = 'https://daheejfree.site/api/kyc/didit-callback',
  className,
  children,
  onClick,
  onBeforeRedirect,
  onError,
  onSuccessUrl,
  disabled,
  id,
  ...rest
}) => {
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  const handleKycClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      // Fire any parent custom onClick passed without altering behavior
      if (onClick) {
        onClick(e);
      }

      if (disabled || isRedirecting) return;

      setIsRedirecting(true);
      onBeforeRedirect?.();

      try {
        // 1. Resolve current user's Supabase user.id
        let resolvedUserId = userId || profileId || '';

        if (!resolvedUserId) {
          try {
            const { data } = await supabase.auth.getUser();
            if (data?.user?.id) {
              resolvedUserId = data.user.id;
            }
          } catch (authErr) {
            console.warn('[KycVerifyButton] Could not retrieve session user id:', authErr);
          }
        }

        if (!resolvedUserId) {
          throw new Error('User identifier not found. Please ensure you are logged in to verify KYC.');
        }

        const canonicalCallback = callbackUrl || 'https://daheejfree.site/api/kyc/didit-callback';

        // 2. Fetch new KYC session URL from backend (/api/kyc/create-session)
        // CRITICAL: Ensure payload includes user's Supabase user.id across all reference fields
        const sessionRes = await fetch('/api/kyc/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: resolvedUserId,
            profileId: resolvedUserId,
            user_id: resolvedUserId,
            vendor_data: resolvedUserId,
            vendorData: resolvedUserId,
            reference: resolvedUserId,
            customerId: resolvedUserId,
            client_reference: resolvedUserId,
            callbackUrl: canonicalCallback,
            returnUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          }),
        });

        let targetUrl: string | null = null;

        if (sessionRes.ok) {
          const sessionData = await sessionRes.json().catch(() => ({}));
          targetUrl =
            sessionData.url ||
            sessionData.session_url ||
            sessionData.verification_url ||
            null;
        } else {
          const errData = await sessionRes.json().catch(() => ({}));
          console.warn('[KycVerifyButton] Session creation endpoint returned error:', errData);
        }

        // 3. Fallback to direct Didit OAuth authorization URL if hosted session URL was not returned
        if (!targetUrl) {
          const clientId =
            (typeof process !== 'undefined' &&
              (process.env.NEXT_PUBLIC_DIDIT_CLIENT_ID ||
                (process.env as any).VITE_DIDIT_CLIENT_ID)) ||
            'daheejfree_kyc';

          const authUrl = new URL('https://apx.didit.me/auth/v2/authorize');
          authUrl.searchParams.set('client_id', clientId);
          authUrl.searchParams.set('response_type', 'code');
          authUrl.searchParams.set('redirect_uri', canonicalCallback);
          authUrl.searchParams.set('scope', 'openid profile identification');
          authUrl.searchParams.set('state', resolvedUserId);
          authUrl.searchParams.set('vendor_data', resolvedUserId);
          authUrl.searchParams.set('reference', resolvedUserId);

          targetUrl = authUrl.toString();
        }

        console.info('[KycVerifyButton] Redirecting to Didit KYC session URL:', targetUrl);
        onSuccessUrl?.(targetUrl);

        // 4. Redirect the user to the KYC session URL
        window.location.href = targetUrl;
      } catch (err: any) {
        console.error('[KycVerifyButton] KYC initiation error:', err);
        setIsRedirecting(false);
        onError?.(err?.message || 'Failed to initiate Didit identity verification');
      }
    },
    [userId, profileId, callbackUrl, onClick, onBeforeRedirect, onError, onSuccessUrl, disabled, isRedirecting]
  );

  // Preserve any custom Tailwind classes passed via props; fallback to a default if none passed
  const defaultClassNames =
    className ||
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 font-medium rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      id={id || 'btn-kyc-verify'}
      type="button"
      className={defaultClassNames}
      onClick={handleKycClick}
      disabled={disabled || isRedirecting}
      {...rest}
    >
      {isRedirecting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Connecting to Didit...</span>
        </>
      ) : (
        children || (
          <>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Verify Identity with Didit</span>
          </>
        )
      )}
    </button>
  );
};

export default KycVerifyButton;
