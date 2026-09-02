// ==============================================================================
// RAZORPAY CHECKOUT ORDER INITIALIZATION ENDPOINT (V4 STRICT)
// ==============================================================================

export const dynamic = 'force-dynamic';

import Razorpay from 'razorpay';
import { SubscriptionTier, BillingCycle } from '../../../../types/database';

interface CheckoutRequestBody {
  tier: SubscriptionTier;
  profileId: string;
  billingCycle?: BillingCycle;
  currency?: string;
}

const TIER_PRICING: Record<SubscriptionTier, { amountPaise: number; name: string }> = {
  free: { amountPaise: 0, name: 'Free Sunnah Plan' },
  gold: { amountPaise: 29900, name: 'Gold Matrimonial' }, // ₹299.00
  platinum: { amountPaise: 49900, name: 'Platinum Matrimonial' }, // ₹499.00
  diamond: { amountPaise: 99900, name: 'Diamond Wali Access' }, // ₹999.00
};

let razorpayInstance: Razorpay | null = null;

function getRazorpayClient(): Razorpay | null {
  const keyId =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.VITE_RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body: CheckoutRequestBody = await req.json();
    const { tier, profileId, billingCycle = 'monthly', currency = 'INR' } = body;

    if (!tier || !profileId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters: tier or profileId',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tierInfo = TIER_PRICING[tier];
    if (!tierInfo) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid subscription tier specified',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const multiplier = billingCycle === 'yearly' ? 9 : 1;
    const finalAmount = tierInfo.amountPaise * multiplier;

    const receiptId = `rcpt_${tier}_${profileId.substring(0, 8)}_${Date.now()}`;

    const razorpayClient = getRazorpayClient();
    if (!razorpayClient && finalAmount > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Razorpay payment gateway credentials are not configured on server.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let generatedOrderId = `order_${Math.random().toString(36).substring(2, 14)}_${Date.now()}`;
    if (razorpayClient && finalAmount > 0) {
      try {
        const rzpOrder = await razorpayClient.orders.create({
          amount: finalAmount,
          currency: currency,
          receipt: receiptId,
          notes: {
            profile_id: profileId,
            tier,
            billing_cycle: billingCycle,
            platform: 'DaheejFree Matrimonial',
          },
        });
        if (rzpOrder && rzpOrder.id) {
          generatedOrderId = rzpOrder.id;
        } else {
          throw new Error('Razorpay order creation did not return an order ID.');
        }
      } catch (rzpErr: any) {
        console.error('[Razorpay Order Creation] Error:', rzpErr);
        return new Response(
          JSON.stringify({
            success: false,
            error: rzpErr?.error?.description || rzpErr?.message || 'Failed to create Razorpay checkout order.',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const razorpayKeyId =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      process.env.VITE_RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_KEY_ID;

    if (finalAmount > 0 && !razorpayKeyId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Razorpay Key ID is not configured on server.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: generatedOrderId,
        amount: finalAmount,
        currency,
        receipt: receiptId,
        tier,
        profileId,
        billingCycle,
        key: razorpayKeyId,
        planName: tierInfo.name,
        notes: {
          profile_id: profileId,
          tier,
          billing_cycle: billingCycle,
          platform: 'DaheejFree Matrimonial',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

