// ==============================================================================
// RAZORPAY FRONTEND CHECKOUT HOOK & DYNAMIC SCRIPT LOADER
// File: src/hooks/useRazorpay.ts
// Provides secure dynamic script loading and opens the Razorpay payment modal
// using server-generated order_id (Server-to-Server Order Creation Pattern)
// ==============================================================================

'use client';

import { useState, useCallback } from 'react';
import { SubscriptionTier, BillingCycle } from '../types';

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayPaymentOptions {
  tier: SubscriptionTier;
  billingCycle?: BillingCycle;
  profileId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  couponCode?: string;
  onSuccess?: (response: RazorpaySuccessResponse) => void;
  onFailure?: (error: string) => void;
  onDismiss?: () => void;
}

export interface RazorpayModalInstance {
  open: () => void;
  close?: () => void;
  on?: (event: string, callback: () => void) => void;
}

/**
 * Dynamically loads the official Razorpay v1 checkout script onto the DOM.
 * Idempotent: checks for existing script tag or window.Razorpay instance.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
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
      console.error('[useRazorpay] Failed to load Razorpay checkout.js script');
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

/**
 * Server-to-Server Order initiation and Razorpay modal trigger
 */
export async function initiateRazorpayCheckout(
  options: RazorpayPaymentOptions
): Promise<{ success: boolean; orderId?: string; paymentId?: string; error?: string }> {
  const {
    tier,
    billingCycle = 'monthly',
    profileId,
    userEmail,
    userName,
    userPhone,
    onSuccess,
    onFailure,
    onDismiss,
  } = options;

  try {
    // 1. Load Razorpay script dynamically
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      const errMsg = 'Razorpay SDK failed to load. Please check your network connection.';
      onFailure?.(errMsg);
      return { success: false, error: errMsg };
    }

    // 2. Server-to-Server Order Creation
    // Calls secure POST /api/payments/create-order route
    const amountInPaise = billingCycle === 'yearly' ? 479000 : 49900;
    const orderRes = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier,
        amount: amountInPaise,
        interval: billingCycle,
        billingCycle,
        couponCode: options.couponCode,
        profileId,
        currency: 'INR',
      }),
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok || !orderData.success) {
      const errMsg = orderData.error || 'Failed to initialize payment order on server';
      onFailure?.(errMsg);
      return { success: false, error: errMsg };
    }

    // Handle free tier or simulated test mode instant activation
    if (orderData.isFree || orderData.isSimulated) {
      const simOrderId = orderData.order_id || orderData.id || orderData.orderId || 'sim_order';
      onSuccess?.({
        razorpay_payment_id: orderData.isSimulated ? `pay_sim_${Date.now()}` : 'free_tier_activation',
        razorpay_order_id: simOrderId,
        razorpay_signature: orderData.isSimulated ? 'sim_verified' : 'free_verified',
      });
      return { success: true, orderId: simOrderId };
    }

    const orderId = orderData.order_id || orderData.id || orderData.orderId;
    const keyId = orderData.key_id || orderData.keyId;

    if (!orderId || !keyId) {
      const errMsg = 'Invalid order response: missing order_id or key_id';
      onFailure?.(errMsg);
      return { success: false, error: errMsg };
    }

    // 3. Open Razorpay Checkout Modal
    return new Promise((resolve) => {
      const rzpOptions = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'DaheejFree Matrimonial',
        description: `${tier.toUpperCase()} Membership (${billingCycle}) - 100% Dowry Free`,
        image: '/icon-192.png',
        order_id: orderId,
        handler: function (response: RazorpaySuccessResponse) {
          console.info('[Razorpay] Payment successful:', response);
          onSuccess?.(response);
          resolve({
            success: true,
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
          });
        },
        prefill: {
          name: userName || '',
          email: userEmail || '',
          contact: userPhone || '',
        },
        notes: {
          profile_id: profileId,
          tier: tier,
          billing_cycle: billingCycle,
        },
        theme: {
          color: '#059669', // Emerald brand theme
        },
        modal: {
          ondismiss: function () {
            console.info('[Razorpay] Checkout modal dismissed by user');
            onDismiss?.();
            resolve({ success: false, error: 'Checkout modal cancelled by user' });
          },
        },
      };

      const razorpayInstance: RazorpayModalInstance = new (window as any).Razorpay(rzpOptions);
      razorpayInstance.open();
    });
  } catch (error: any) {
    console.error('[Razorpay Checkout Error]:', error);
    const errMsg = error?.message || 'Payment initiation failed';
    onFailure?.(errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Custom React Hook for triggering Razorpay checkout anywhere in the application
 */
export function useRazorpay() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const openCheckout = useCallback(async (options: RazorpayPaymentOptions) => {
    setIsLoading(true);
    setError(null);

    const result = await initiateRazorpayCheckout({
      ...options,
      onFailure: (err) => {
        setError(err);
        options.onFailure?.(err);
      },
    });

    setIsLoading(false);
    return result;
  }, []);

  return {
    openCheckout,
    isLoading,
    error,
    loadScript: loadRazorpayScript,
  };
}
