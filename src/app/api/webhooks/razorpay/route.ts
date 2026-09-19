// ==============================================================================
// NEXT.JS API ROUTE: RAZORPAY WEBHOOK VERIFICATION & SUPABASE TIER FULFILLMENT
// File: src/app/api/webhooks/razorpay/route.ts
// Strict HMAC-SHA256 signature verification & Supabase Service Role fulfillment
// ==============================================================================

export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  notes?: {
    profile_id?: string;
    tier?: string;
    billing_cycle?: 'monthly' | 'yearly';
    app_name?: string;
  };
}

interface RazorpayWebhookPayload {
  event: string;
  created_at: number;
  payload?: {
    payment?: {
      entity: RazorpayPaymentEntity;
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        receipt?: string;
        notes?: {
          profile_id?: string;
          tier?: string;
          billing_cycle?: 'monthly' | 'yearly';
        };
      };
    };
  };
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[Razorpay Webhook] Missing SUPABASE_SERVICE_ROLE_KEY or Supabase URL on server.');
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured on server.');
      return new Response(
        JSON.stringify({ error: 'Server webhook secret misconfiguration' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!signature) {
      console.warn('[Razorpay Webhook] Missing x-razorpay-signature header in request.');
      return new Response(
        JSON.stringify({ error: 'Missing x-razorpay-signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Strict Cryptographic HMAC-SHA256 Signature Verification
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    const isVerified =
      sigBuf.length === expBuf.length &&
      crypto.timingSafeEqual(sigBuf, expBuf);

    if (!isVerified) {
      console.warn('[Razorpay Webhook] HMAC Signature Verification FAILED. Possible spoofing attempt.');
      return new Response(
        JSON.stringify({ error: 'Invalid HMAC signature verification' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse verified webhook payload
    const eventPayload: RazorpayWebhookPayload = JSON.parse(rawBody);
    const eventName = eventPayload.event;

    console.info(`[Razorpay Webhook] Verified event received: ${eventName}`);

    // 3. Process payment confirmation events
    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const paymentEntity = eventPayload.payload?.payment?.entity;
      const orderEntity = eventPayload.payload?.order?.entity;

      const profileId =
        (paymentEntity?.notes as any)?.supabase_id ||
        (paymentEntity?.notes as any)?.user_id ||
        (paymentEntity?.notes as any)?.profile_id ||
        (orderEntity?.notes as any)?.supabase_id ||
        (orderEntity?.notes as any)?.user_id ||
        (orderEntity?.notes as any)?.profile_id;

      let rawTier = (
        paymentEntity?.notes?.tier ||
        orderEntity?.notes?.tier ||
        'gold'
      ).toLowerCase().trim();

      // Normalize tier to gold or diamond as specified in the pipeline
      const tier = rawTier === 'diamond' || rawTier === 'platinum' ? 'diamond' : 'gold';

      const billingCycle = (
        paymentEntity?.notes?.billing_cycle ||
        orderEntity?.notes?.billing_cycle ||
        'monthly'
      ).toLowerCase();

      const paymentId = paymentEntity?.id || `pay_${Date.now()}`;
      const orderId = paymentEntity?.order_id || orderEntity?.id || `order_${Date.now()}`;

      if (profileId && tier) {
        const supabaseAdmin = getSupabaseAdmin();

        if (supabaseAdmin) {
          // 4. Update user's subscription_tier in Supabase using the Service Role Key
          const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({
              subscription_tier: tier,
              membership_tier: tier,
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', profileId);

          if (profileUpdateError) {
            console.error('[Razorpay Webhook] Error updating profile subscription_tier:', profileUpdateError);
          } else {
            console.info(`[Razorpay Webhook] Successfully upgraded profile ${profileId} to tier ${tier}`);
          }

          // 5. Upsert subscription billing audit record
          const periodEnd = new Date();
          if (billingCycle === 'yearly') {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
          }

          const { error: subError } = await supabaseAdmin
            .from('subscriptions')
            .upsert(
              {
                profile_id: profileId,
                tier: tier,
                billing_cycle: billingCycle,
                status: 'active',
                razorpay_payment_id: paymentId,
                razorpay_order_id: orderId,
                current_period_start: new Date().toISOString(),
                current_period_end: periodEnd.toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'profile_id' }
            );

          if (subError) {
            console.warn('[Razorpay Webhook] Notice logging subscription record:', subError.message);
          }
        } else {
          console.error('[Razorpay Webhook] Could not initialize Supabase Admin client to fulfill order.');
        }
      } else {
        console.warn('[Razorpay Webhook] Missing profile_id in payment entity notes:', paymentEntity?.notes);
      }
    }

    return new Response(
      JSON.stringify({ success: true, received: true, event: eventName }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Razorpay Webhook Exception]:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal webhook error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
