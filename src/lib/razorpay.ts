// ==============================================================================
// PAYMENT GATEWAY RE-EXPORT (DODO PAYMENTS PRODUCTION MIGRATION)
// Razorpay has been fully deprecated and replaced by Dodo Payments
// ==============================================================================

export {
  SUBSCRIPTION_PLANS,
  initiateDodoCheckout,
  type PlanDetails,
  type DodoCheckoutResponse,
} from './dodoPayments';

import { initiateDodoCheckout } from './dodoPayments';
import { SubscriptionTier, BillingCycle } from '../types';

/**
 * Legacy compatibility bridge forwarding to Dodo Payments
 */
export async function initiateRazorpaySubscription(
  tier: SubscriptionTier,
  billingCycle: BillingCycle = 'monthly',
  profileId: string,
  userEmail?: string,
  userName?: string
) {
  return initiateDodoCheckout({
    tier,
    billingCycle,
    profileId,
    customerEmail: userEmail,
    customerName: userName,
  });
}
