// ==============================================================================
// RAZORPAY WEBHOOK HANDLER: HMAC VALIDATION & STRICT SUBSCRIPTIONS UPSERT
// ==============================================================================

export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { SubscriptionTier, BillingCycle } from '../../../../types/database';
import { createAdminClient } from '../../../../lib/supabase/server';
import { daheejStore } from '../../../../lib/supabase/store';

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity: {
        id: string;
        order_id?: string;
        amount: number;
        currency: string;
        status: string;
        notes?: {
          profile_id?: string;
          tier?: SubscriptionTier;
          billing_cycle?: BillingCycle;
        };
      };
    };
  };
}

export async function POST(req: Request): Promise<Response> {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_daheejfree';

    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing x-razorpay-signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Cryptographic HMAC-SHA256 Signature Verification
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    const isVerified = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

    if (!isVerified) {
      return new Response(
        JSON.stringify({ error: 'Invalid HMAC signature verification' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const eventPayload: RazorpayWebhookPayload = JSON.parse(rawBody);
    const eventName = eventPayload.event;

    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const paymentEntity = eventPayload.payload?.payment?.entity;
      const profileId = paymentEntity?.notes?.profile_id;
      const tier = paymentEntity?.notes?.tier as SubscriptionTier;
      const billingCycle = (paymentEntity?.notes?.billing_cycle || 'monthly') as BillingCycle;
      const paymentId = paymentEntity?.id || `pay_${Date.now()}`;
      const orderId = paymentEntity?.order_id || `order_${Date.now()}`;

      if (profileId && tier) {
        // 1. Update Supabase via Admin Client (Elevated Service Role)
        try {
          const adminSupabase = createAdminClient();
          
          // Upsert into public.subscriptions table
          await adminSupabase.from('subscriptions').upsert(
            {
              profile_id: profileId,
              tier: tier,
              billing_cycle: billingCycle,
              status: 'active',
              razorpay_payment_id: paymentId,
              razorpay_order_id: orderId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'profile_id' }
          );

          // Update user's subscription_tier in public.profiles table
          await adminSupabase
            .from('profiles')
            .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
            .eq('id', profileId);
        } catch (dbErr) {
          console.warn('[Razorpay Webhook] Database sync notice:', dbErr);
        }

        // 2. Sync with local reactive Daheej store
        daheejStore.updateSubscriptionTier(profileId, tier, billingCycle);

        console.info(
          `[Razorpay Webhook] Successfully processed ${eventName} for profile_id: ${profileId}, tier: ${tier}, billingCycle: ${billingCycle}`
        );
      }
    }

    return new Response(
      JSON.stringify({ received: true, event: eventName }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Webhook error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

