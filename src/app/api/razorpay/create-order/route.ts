// ==============================================================================
// NEXT.JS API ROUTE: RAZORPAY SERVER-TO-SERVER ORDER CREATION
// File: src/app/api/razorpay/create-order/route.ts
// Prevents frontend tampering by calculating amounts and initiating orders server-side
// ==============================================================================

export const dynamic = 'force-dynamic';

import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

// Strict canonical tier pricing in INR Paise (1 INR = 100 paise)
export const TIER_PRICING_PAISE: Record<string, { monthly: number; yearly: number; name: string }> = {
  free: { monthly: 0, yearly: 0, name: 'Free Sunnah Plan' },
  gold: { monthly: 49900, yearly: 479000, name: 'Gold Matrimonial' }, // ₹499/mo, ₹4,790/yr
  platinum: { monthly: 99900, yearly: 959000, name: 'Platinum Matrimonial' }, // ₹999/mo, ₹9,590/yr
  diamond: { monthly: 99900, yearly: 959000, name: 'Diamond Wali Access' }, // ₹999/mo, ₹9,590/yr
};

export interface CreateOrderRequest {
  tier: string;
  billingCycle?: 'monthly' | 'yearly';
  profileId: string;
  currency?: string;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id?: string;
  id?: string;
  amount?: number;
  currency?: string;
  key_id?: string;
  tier?: string;
  billingCycle?: string;
  isFree?: boolean;
  message?: string;
  error?: string;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body: CreateOrderRequest = await req.json().catch(() => ({} as any));
    const {
      tier: rawTier = 'gold',
      billingCycle = 'monthly',
      profileId,
      currency = 'INR',
    } = body;

    const tier = String(rawTier || 'gold').toLowerCase().trim();

    // 1. Validate required fields
    if (!profileId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required profileId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const planConfig = TIER_PRICING_PAISE[tier];
    if (!planConfig) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid tier '${tier}'. Allowed: ${Object.keys(TIER_PRICING_PAISE).join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Free Tier bypasses Razorpay payment gateway
    if (tier === 'free' || (planConfig.monthly === 0 && planConfig.yearly === 0)) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', profileId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          isFree: true,
          tier: 'free',
          message: 'Free Sunnah plan activated successfully.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Strict Razorpay credentials verification
    const keyId =
      process.env.RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      process.env.VITE_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('[Razorpay Order] Missing server credentials: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured.');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Razorpay payment gateway credentials not configured on server (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Calculate exact amount server-side to prevent client tampering
    const amountInPaise = billingCycle === 'yearly' ? planConfig.yearly : planConfig.monthly;
    const cleanReceipt = `rcpt_${profileId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}_${Date.now()}`;

    // 5. Initialize Razorpay instance securely on server
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // 6. Create Razorpay order via orders.create()
    const orderOptions = {
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt: cleanReceipt,
      notes: {
        profile_id: profileId,
        tier: tier,
        billing_cycle: billingCycle,
        app_name: 'DaheejFree Matrimonial',
      },
      payment_capture: 1, // Auto-capture payment on success
    };

    const order = await razorpay.orders.create(orderOptions);

    if (!order || !order.id) {
      throw new Error('Razorpay order creation did not return a valid order ID.');
    }

    console.info(`[Razorpay Order Created] Order ID: ${order.id}, Profile: ${profileId}, Tier: ${tier}, Amount: ${amountInPaise}`);

    // 7. Return order_id, amount, currency, and public key_id to frontend
    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: keyId,
        tier,
        billingCycle,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Razorpay Order Creation Exception]:', error);
    const errorMessage = error?.error?.description || error?.message || 'Failed to create Razorpay order';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
