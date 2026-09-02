// ==============================================================================
// DODO PAYMENTS PRODUCTION INTEGRATION & 3-TIER SUBSCRIPTION MANAGEMENT
// ==============================================================================
// Strictly 3 Subscription Tiers: Free (Upgraded), Gold, and Diamond
// Production Base URL: https://live.dodopayments.com
// ==============================================================================

import { SubscriptionTier, BillingCycle, PlanDetail } from '../types';
import { daheejStore } from './supabase/store';
import { supabase } from './supabase/client';

export type PlanDetails = PlanDetail;

/**
 * Production 3-Tier Subscription Plans Architecture (Single Source of Truth)
 */
export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, PlanDetail> = {
  free: {
    id: 'free',
    name: 'Free Sunnah',
    tagline: 'Forever Free Sunnah Matrimony',
    eyebrow: 'Base Sunnah Tier',
    priceINR: 0,
    priceUSD: 0,
    annualPriceINR: 0,
    annualPriceUSD: 0,
    period: 'Forever Free',
    desc: 'Essential Nikah discovery with photo privacy blurring, Didit KYC verification, and strict anti-dowry charter protections.',
    features: [
      'Browse 100% verified Islamic candidate profiles (privacy blurred)',
      'Send up to 3 match requests per day',
      'Receive & accept incoming match requests from suitable candidates',
      'Unlimited encrypted text chat with mutual accepted matches (Requires KYC)',
      'Zero Dowry Shariah Registry protection & covenant',
      'Live identity verification via Didit.me biometric protocol',
    ],
    btnText: 'Current Base Plan',
    badge: 'Sunnah Base',
  },
  gold: {
    id: 'gold',
    name: 'Gold Member',
    tagline: 'Photo Consent & Unlimited Connections',
    eyebrow: 'Most Popular for Singles',
    priceINR: 499,
    priceUSD: 6,
    annualPriceINR: 4790,
    annualPriceUSD: 58,
    period: '/month',
    desc: 'Unlock 2-way mutual unblurred photo consent, unlimited match requests, live read receipts, and verified Gold badge.',
    popular: true,
    features: [
      'All Free Sunnah features included',
      'Unlimited daily match & interest requests',
      'Request & grant 2-way unblurred photo consent permissions',
      'Live message read receipts & delivery status in chat',
      'Priority candidate discovery placement in searches',
      'Verified Gold Shield badge on profile',
    ],
    btnText: 'Upgrade to Gold',
    badge: 'Most Popular',
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond (Wali & Calls)',
    tagline: 'Full Family & Video Calling VIP Access',
    eyebrow: 'Comprehensive Family Tier',
    priceINR: 999,
    priceUSD: 12,
    annualPriceINR: 9590,
    annualPriceUSD: 115,
    period: '/month',
    desc: 'The complete matrimonial package with direct Guardian (Wali) contact facilitation, WebRTC audio/video calls, and family conferencing.',
    recommended: true,
    features: [
      'All Gold Member features included',
      'Direct Guardian (Wali) phone number & email contact facilitation',
      'End-to-end WebRTC Audio & Video Calling in browser (No phone numbers exposed)',
      'Dedicated Diamond VIP Profile Shield badge',
      'Family-to-family conference call facilitation',
      'Official Bila-Daheej Anti-Dowry Nikah Certificate facilitation',
      'Priority 24/7 dedicated matrimonial assistance',
    ],
    btnText: 'Unlock Diamond VIP',
    badge: 'Best Value • VIP',
  },
  // Backward compatibility alias for any legacy records
  platinum: {
    id: 'platinum',
    name: 'Diamond (Wali & Calls)',
    tagline: 'Full Family & Video Calling VIP Access',
    eyebrow: 'Comprehensive Family Tier',
    priceINR: 999,
    priceUSD: 12,
    annualPriceINR: 9590,
    annualPriceUSD: 115,
    period: '/month',
    desc: 'The complete matrimonial package with direct Guardian (Wali) contact facilitation, WebRTC audio/video calls, and family conferencing.',
    recommended: true,
    features: [
      'All Gold Member features included',
      'Direct Guardian (Wali) phone number & email contact facilitation',
      'End-to-end WebRTC Audio & Video Calling in browser (No phone numbers exposed)',
      'Dedicated Diamond VIP Profile Shield badge',
      'Family-to-family conference call facilitation',
      'Official Bila-Daheej Anti-Dowry Nikah Certificate facilitation',
      'Priority 24/7 dedicated matrimonial assistance',
    ],
    btnText: 'Unlock Diamond VIP',
    badge: 'Best Value • VIP',
  },
};

export interface DodoCheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  paymentId?: string;
  error?: string;
}

/**
 * Initiates Dodo Payments Checkout for Subscription Tier Upgrades
 */
export async function initiateDodoCheckout({
  tier,
  billingCycle = 'monthly',
  profileId,
  customerEmail,
  customerName,
  returnUrl,
}: {
  tier: SubscriptionTier;
  billingCycle?: BillingCycle;
  profileId: string;
  customerEmail?: string;
  customerName?: string;
  returnUrl?: string;
}): Promise<DodoCheckoutResponse> {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (!plan) {
    return { success: false, error: 'Invalid subscription tier selected' };
  }

  // If Free plan selected, update immediately
  if (tier === 'free' || plan.priceINR === 0) {
    daheejStore.updateProfile(profileId, {
      subscription_tier: 'free',
      membership_tier: 'free',
    });
    try {
      await supabase
        .from('profiles')
        .update({
          subscription_tier: 'free',
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);
    } catch (e) {
      console.warn('[Dodo] Free tier update note:', e);
    }
    return { success: true };
  }

  try {
    const res = await fetch('/api/payments/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profileId,
        profileId,
        tier,
        billingCycle,
        customerEmail,
        customerName,
        returnUrl: returnUrl || (typeof window !== 'undefined' ? `${window.location.origin}/dashboard?payment=success&tier=${tier}` : undefined),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Payment server error (${res.status}): ${errText.slice(0, 150)}`);
    }

    let data: any = {};
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      console.error('[Dodo Payments] Non-JSON server response:', text.slice(0, 150));
      throw new Error('Payment server returned an invalid response format.');
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to initialize Dodo Payments session');
    }

    if (data.checkoutUrl) {
      if (typeof window !== 'undefined') {
        window.location.href = data.checkoutUrl;
      }
      return { success: true, checkoutUrl: data.checkoutUrl, paymentId: data.paymentId };
    }

    return { success: false, error: 'No checkout URL returned from live payment gateway.' };
  } catch (error: any) {
    console.error('[Dodo Payments] Checkout exception:', error);
    return {
      success: false,
      error: error?.message || 'Unable to connect to Dodo Payments gateway.',
    };
  }
}
