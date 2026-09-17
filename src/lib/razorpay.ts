// ==============================================================================
// RAZORPAY INTEGRATION & GATEWAY EXPORTS
// File: src/lib/razorpay.ts
// Server-to-Server Razorpay checkout with dynamic client SDK loader
// ==============================================================================

export {
  initiateRazorpayCheckout,
  useRazorpay,
  loadRazorpayScript,
  type RazorpayPaymentOptions,
  type RazorpaySuccessResponse,
} from '../hooks/useRazorpay';

export {
  SUBSCRIPTION_PLANS,
  initiateDodoCheckout,
  type PlanDetails,
  type DodoCheckoutResponse,
} from './dodoPayments';

import { initiateRazorpayCheckout } from '../hooks/useRazorpay';
import { SubscriptionTier, BillingCycle } from '../types';

/**
 * Initiates Razorpay payment checkout using server-generated order ID
 */
export async function initiateRazorpaySubscription(
  tier: SubscriptionTier,
  billingCycle: BillingCycle = 'monthly',
  profileId: string,
  userEmail?: string,
  userName?: string
) {
  return initiateRazorpayCheckout({
    tier,
    billingCycle,
    profileId,
    userEmail,
    userName,
  });
}
