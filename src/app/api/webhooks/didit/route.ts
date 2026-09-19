// ==============================================================================
// NEXT.JS API ROUTE: DIDIT KYC WEBHOOK LISTENER
// File: src/app/api/webhooks/didit/route.ts
// Receives real-time updates from Didit when a user completes their KYC session
// 1. Cryptographically verifies webhook signature using DIDIT_WEBHOOK_SECRET
// 2. Extracts user Supabase ID from vendor_data / reference / customerId
// 3. Updates public.profiles using Supabase Service Role Key:
//    set kyc_verified: true and kyc_status: 'verified'
// 4. Returns 200 OK immediately so Didit acknowledges delivery
// ==============================================================================

export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

interface DiditWebhookPayload {
  event?: string;
  session_id?: string;
  id?: string;
  status?: string;
  decision?: string;
  decision_status?: string;
  verification_status?: string;
  verified?: boolean;
  vendor_data?: string;
  vendorData?: string;
  reference?: string;
  reference_id?: string;
  client_reference?: string;
  customer_id?: string;
  customerId?: string;
  userId?: string;
  user_id?: string;
  profile_id?: string;
  profileId?: string;
  metadata?: {
    userId?: string;
    user_id?: string;
    reference?: string;
    [key: string]: any;
  };
  data?: {
    session_id?: string;
    status?: string;
    decision?: string;
    verified?: boolean;
    vendor_data?: string;
    vendorData?: string;
    reference?: string;
    customer_id?: string;
    userId?: string;
    user_id?: string;
    [key: string]: any;
  };
  timestamp?: number;
}

/**
 * Initializes the Supabase Admin client with Service Role Key to safely bypass RLS
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[Didit Webhook] Missing SUPABASE_SERVICE_ROLE_KEY or Supabase URL on server.');
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Robust HMAC-SHA256 signature verification supporting raw hex, base64,
 * and timestamped t=...,v1=... schemes.
 */
function verifyDiditSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
  timestampHeader?: string | null
): boolean {
  try {
    const cleanSecret = webhookSecret.trim();

    // 1. Check for timestamped Svix / Stripe / Didit format: t=<timestamp>,v1=<sig> or v0=<sig>
    if (signatureHeader.includes('v1=') || signatureHeader.includes('v0=')) {
      const parts = signatureHeader.split(/[, ]+/);
      let t = timestampHeader || '';
      let sigs: string[] = [];

      for (const part of parts) {
        const [k, v] = part.split('=');
        if (k === 't') {
          t = v;
        } else if (k === 'v1' || k === 'v0') {
          sigs.push(v);
        }
      }

      for (const sig of sigs) {
        // Attempt with timestamp prefix: `${t}.${rawBody}`
        if (t) {
          const expectedWithTimestamp = crypto
            .createHmac('sha256', cleanSecret)
            .update(`${t}.${rawBody}`)
            .digest('hex');

          if (safeCompare(sig, expectedWithTimestamp)) {
            return true;
          }

          const expectedBase64 = crypto
            .createHmac('sha256', cleanSecret)
            .update(`${t}.${rawBody}`)
            .digest('base64');

          if (safeCompare(sig, expectedBase64)) {
            return true;
          }
        }

        // Attempt direct body hash with v1 signature
        const expectedDirect = crypto
          .createHmac('sha256', cleanSecret)
          .update(rawBody)
          .digest('hex');

        if (safeCompare(sig, expectedDirect)) {
          return true;
        }
      }
    }

    // 2. Direct SHA256 hex or prefix sha256=<hex>
    let candidateSig = signatureHeader.trim();
    if (candidateSig.startsWith('sha256=')) {
      candidateSig = candidateSig.slice(7);
    }

    const expectedHex = crypto
      .createHmac('sha256', cleanSecret)
      .update(rawBody)
      .digest('hex');

    if (safeCompare(candidateSig, expectedHex)) {
      return true;
    }

    // 3. Fallback to base64 check
    const expectedBase64 = crypto
      .createHmac('sha256', cleanSecret)
      .update(rawBody)
      .digest('base64');

    if (safeCompare(candidateSig, expectedBase64)) {
      return true;
    }

    return false;
  } catch (err) {
    console.error('[Didit Webhook Signature Error]:', err);
    return false;
  }
}

/**
 * Constant-time safe string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    // 1. Read raw body as text for HMAC verification
    const rawBody = await req.text();

    // 2. Extract Didit signature headers
    const signature =
      req.headers.get('didit-signature') ||
      req.headers.get('x-didit-signature') ||
      req.headers.get('x-signature') ||
      req.headers.get('signature');

    const timestamp =
      req.headers.get('didit-timestamp') ||
      req.headers.get('x-didit-timestamp') ||
      req.headers.get('x-timestamp');

    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Didit Webhook] DIDIT_WEBHOOK_SECRET is not configured on server.');
      return new Response(
        JSON.stringify({ error: 'Server webhook secret misconfiguration' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!signature) {
      console.warn('[Didit Webhook] Missing signature header in incoming webhook request.');
      return new Response(
        JSON.stringify({ error: 'Missing Didit signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Cryptographic Signature Verification
    const isValidSignature = verifyDiditSignature(rawBody, signature, webhookSecret, timestamp);

    if (!isValidSignature) {
      console.warn('[Didit Webhook] Invalid webhook signature detected. Potential spoofing attempt blocked.');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Parse verified payload
    let payload: DiditWebhookPayload = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      console.warn('[Didit Webhook] Failed to parse verified body as JSON:', rawBody.slice(0, 200));
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sessionId =
      payload.session_id ||
      payload.id ||
      payload.data?.session_id ||
      null;

    // 5. Extract user's Supabase ID passed as reference/vendor ID
    const userId =
      payload.vendor_data ||
      payload.vendorData ||
      payload.reference ||
      payload.reference_id ||
      payload.client_reference ||
      payload.customer_id ||
      payload.customerId ||
      payload.userId ||
      payload.user_id ||
      payload.profile_id ||
      payload.profileId ||
      payload.metadata?.userId ||
      payload.metadata?.user_id ||
      payload.metadata?.reference ||
      payload.data?.vendor_data ||
      payload.data?.vendorData ||
      payload.data?.reference ||
      payload.data?.customer_id ||
      payload.data?.userId ||
      payload.data?.user_id;

    const rawStatus = String(
      payload.status ||
      payload.decision ||
      payload.decision_status ||
      payload.verification_status ||
      payload.event ||
      payload.data?.status ||
      payload.data?.decision ||
      ''
    ).toLowerCase().trim();

    // Check if status confirms identity
    const isApproved =
      rawStatus === 'approved' ||
      rawStatus === 'verified' ||
      rawStatus === 'completed' ||
      rawStatus === 'success' ||
      rawStatus === 'verification.approved' ||
      rawStatus === 'session.approved' ||
      rawStatus === 'session.completed' ||
      payload.verified === true ||
      payload.data?.verified === true;

    console.info(
      `[Didit Webhook Verified] Event received for User: ${userId}, Session: ${sessionId}, Status: ${rawStatus}, Approved: ${isApproved}`
    );

    if (!userId) {
      console.warn('[Didit Webhook] No Supabase user reference identifier found in payload:', payload);
      // Return 200 OK so Didit does not endlessly retry a malformed or anonymous event
      return new Response(
        JSON.stringify({ received: true, warning: 'No user reference found in payload' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ error: 'Supabase Service Role configuration missing on server' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Database Update via Supabase Service Role Key
    if (isApproved) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          kyc_verified: true,
          kyc_status: 'verified',
          is_verified: true,
          id_verified: true,
          selfie_verified: true,
          didit_session_id: sessionId,
          kyc_session_id: sessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[Didit Webhook] Failed to update profile with Service Role Key:', updateError);
        return new Response(
          JSON.stringify({ error: 'Database update failed', details: updateError.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.info(`[Didit Webhook] User ${userId} successfully upgraded to kyc_verified: true, kyc_status: 'verified'`);
    } else if (
      rawStatus === 'declined' ||
      rawStatus === 'rejected' ||
      rawStatus === 'failed' ||
      rawStatus === 'session.rejected'
    ) {
      await supabaseAdmin
        .from('profiles')
        .update({
          kyc_verified: false,
          kyc_status: 'rejected',
          didit_session_id: sessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      console.info(`[Didit Webhook] User ${userId} marked as rejected/unverified.`);
    }

    // 7. Return 200 OK immediately so Didit acknowledges delivery
    return new Response(
      JSON.stringify({
        received: true,
        status: isApproved ? 'verified' : rawStatus,
        userId,
        sessionId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Didit Webhook Exception]:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal webhook error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
