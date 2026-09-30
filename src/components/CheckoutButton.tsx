'use client';

// ==============================================================================
// RAZORPAY CHECKOUT BUTTON CLIENT COMPONENT
// File: src/components/CheckoutButton.tsx
// Fetches order_id from /api/razorpay/create-order, dynamically loads
// https://checkout.razorpay.com/v1/checkout.js, and opens the Razorpay modal.
// Ensures the user's Supabase ID is passed in the notes object.
// ==============================================================================

import React, { useState, useCallback } from 'react';
import { Loader2, CreditCard } from 'lucide-react';

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface CheckoutButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onError'> {
  tier?: 'gold' | 'diamond' | 'free' | string;
  userId?: string;
  profileId?: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  billingCycle?: 'monthly' | 'yearly';
  className?: string;
  children?: React.ReactNode;
  onSuccess?: (response: RazorpaySuccessResponse) => void;
  onError?: (error: string) => void;
  onDismiss?: () => void;
}

/**
 * Dynamically loads the official Razorpay v1 checkout script onto the DOM.
 * Idempotent check to avoid duplicate script injection.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('[CheckoutButton] Failed to load Razorpay checkout.js script');
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

export const CheckoutButton: React.FC<CheckoutButtonProps> = ({
  tier = 'gold',
  userId,
  profileId,
  userEmail,
  userName,
  userPhone,
  billingCycle = 'monthly',
  className,
  children,
  onSuccess,
  onError,
  onDismiss,
  disabled,
  onClick,
  id,
  ...rest
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const effectiveUserId = userId || profileId || '';

  const handleCheckoutClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      // Allow parent custom onClick to fire if passed
      if (onClick) {
        onClick(e);
      }

      if (disabled || isLoading) return;

      setIsLoading(true);

      try {
        // 1. Dynamically load official Razorpay SDK
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error('Could not load Razorpay payment gateway script. Please check your internet connection.');
        }

        // 2. Fetch server-generated order_id from /api/payments/create-order
        const orderRes = await fetch('/api/payments/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tier,
            billingCycle,
            profileId: effectiveUserId,
            userId: effectiveUserId,
            currency: 'INR',
          }),
        });

        const orderData = await orderRes.json().catch(() => ({}));

        if (!orderRes.ok || !orderData.success) {
          const errMsg = orderData.error || `Failed to create payment order (HTTP ${orderRes.status})`;
          throw new Error(errMsg);
        }

        // Handle free tier instant fulfillment
        if (orderData.isFree) {
          setIsLoading(false);
          onSuccess?.({
            razorpay_payment_id: 'free_tier_activation',
            razorpay_order_id: 'free_order',
            razorpay_signature: 'free_verified',
          });
          return;
        }

        const orderId = orderData.order_id || orderData.id;
        const keyId = orderData.key_id;

        if (!orderId || !keyId) {
          throw new Error('Server order response missing order_id or key_id.');
        }

        // 3. Configure Razorpay modal with user Supabase ID in notes
        const rzpOptions = {
          key: keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'DaheejFree Matrimonial',
          description: `${tier.toUpperCase()} Membership (${billingCycle}) - 100% Dowry Free`,
          image: '/icon-192.png',
          order_id: orderId,
          notes: {
            profile_id: effectiveUserId,
            user_id: effectiveUserId,
            supabase_id: effectiveUserId,
            tier: tier.toLowerCase(),
            billing_cycle: billingCycle,
          },
          prefill: {
            name: userName || '',
            email: userEmail || '',
            contact: userPhone || '',
          },
          theme: {
            color: '#059669', // Emerald brand theme
          },
          handler: (response: RazorpaySuccessResponse) => {
            console.info('[CheckoutButton] Razorpay payment captured successfully:', response);
            setIsLoading(false);
            onSuccess?.(response);
          },
          modal: {
            ondismiss: () => {
              console.info('[CheckoutButton] Razorpay modal dismissed');
              setIsLoading(false);
              onDismiss?.();
            },
          },
        };

        // 4. Open Razorpay Checkout Modal
        const rzpInstance = new (window as any).Razorpay(rzpOptions);
        rzpInstance.open();
      } catch (err: any) {
        console.error('[CheckoutButton] Payment initiation error:', err);
        const errorMessage = err?.message || 'Failed to initialize Razorpay checkout';
        setIsLoading(false);
        onError?.(errorMessage);
      }
    },
    [tier, billingCycle, effectiveUserId, userName, userEmail, userPhone, disabled, isLoading, onClick, onSuccess, onError, onDismiss]
  );

  // Preserve any custom Tailwind classes passed via props; provide a sleek default if none provided
  const defaultClassNames =
    className ||
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 font-medium rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      id={id || `checkout-btn-${tier}`}
      type="button"
      className={defaultClassNames}
      onClick={handleCheckoutClick}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Processing...</span>
        </>
      ) : (
        children || (
          <>
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Upgrade to {tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
          </>
        )
      )}
    </button>
  );
};

export default CheckoutButton;
