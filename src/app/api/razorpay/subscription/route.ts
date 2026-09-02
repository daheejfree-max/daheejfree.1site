// ==============================================================================
// NEXT.JS API ROUTE: RAZORPAY SUBSCRIPTION CREATION (STRICT ERROR HANDLING)
// ==============================================================================

import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

// Plan pricing in INR paise (e.g. ₹299 = 29900 paise)
const PLAN_PRICES_INR: Record<string, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  gold: { monthly: 29900, yearly: 299900 },
  platinum: { monthly: 49900, yearly: 499900 },
  diamond: { monthly: 99900, yearly: 999900 },
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { tier = 'gold', profileId, billingCycle = 'monthly' } = body;

    // 1. Validate Tier
    if (!tier || !PLAN_PRICES_INR[tier]) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid subscription tier selected' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Free Tier Bypasses Razorpay Gateway
    const priceData = PLAN_PRICES_INR[tier];
    const amountInPaise = billingCycle === 'yearly' ? priceData.yearly : priceData.monthly;

    if (amountInPaise === 0 || tier === 'free') {
      return new Response(
        JSON.stringify({
          success: true,
          isFree: true,
          tier: 'free',
          subscription_id: null,
          message: 'Switched to free tier successfully',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Strict Check: RAZORPAY_PLAN_ID Environment Variable
    // Allow general RAZORPAY_PLAN_ID or tier-specific RAZORPAY_PLAN_ID
    const envPlanId =
      process.env.RAZORPAY_PLAN_ID ||
      process.env[`RAZORPAY_PLAN_ID_${tier.toUpperCase()}`];

    if (!envPlanId) {
      console.error(
        'Razorpay API Error:',
        new Error('RAZORPAY_PLAN_ID is not configured in environment variables.')
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RAZORPAY_PLAN_ID is not configured in environment variables.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const key_id =
      process.env.RAZORPAY_KEY_ID ||
      process.env.VITE_RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      const errorMsg = 'Razorpay API credentials (KEY_ID or KEY_SECRET) are missing.';
      console.error('Razorpay API Error:', new Error(errorMsg));
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Strict Razorpay Subscription Creation
    let subscription_id: string;

    try {
      const razorpayInstance = new Razorpay({
        key_id: key_id,
        key_secret: key_secret,
      });

      // 7-day free trial timestamp (Unix epoch in seconds, 7 days from now)
      const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
      const start_at = Math.floor(Date.now() / 1000) + SEVEN_DAYS_SECONDS;

      const subscription = await razorpayInstance.subscriptions.create({
        plan_id: envPlanId,
        total_count: billingCycle === 'yearly' ? 10 : 120,
        quantity: 1,
        start_at: start_at,
        customer_notify: 1,
        notes: {
          profileId: profileId || '',
          tier,
          billingCycle,
          trial: '7_days_free',
          app: 'DaheejFree Matrimonial',
        },
      });

      if (!subscription || !subscription.id) {
        throw new Error('Razorpay subscription object did not return a valid ID.');
      }

      subscription_id = subscription.id;
    } catch (razorpayError: any) {
      console.error('Razorpay API Error:', razorpayError);
      return new Response(
        JSON.stringify({
          success: false,
          error:
            razorpayError?.error?.description ||
            razorpayError?.message ||
            'Failed to create subscription with Razorpay.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Optional Supabase Profile State Synchronization
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && profileId) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_id: subscription_id,
            subscription_status: 'trialing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', profileId);
      } catch (dbErr) {
        console.warn('[Supabase Sync Warning]:', dbErr);
      }
    }

    // 6. Return Clean Success JSON with subscription_id
    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription_id,
        plan_id: envPlanId,
        key: key_id,
        tier,
        billingCycle,
        amount: amountInPaise,
        currency: 'INR',
        trial_days: 7,
        profileId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Razorpay API Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error processing subscription request.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
