// ==============================================================================
// NEXT.JS API ROUTE: DIDIT KYC VERIFICATION CALLBACK & WEBHOOK HANDLER
// File: src/app/api/kyc/didit-callback/route.ts
// Privacy-first decentralized identity: stores only verification flags and session tokens
// NEVER stores unencrypted PII, passports, or raw ID card photos
// ==============================================================================

export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

interface DiditWebhookBody {
  session_id?: string;
  id?: string;
  status?: string;
  decision?: string;
  event?: string;
  verification_status?: string;
  verified?: boolean;
  vendor_data?: string;
  vendorData?: string;
  userId?: string;
  user_id?: string;
  profile_id?: string;
  profileId?: string;
  workflow_id?: string;
  timestamp?: number;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[Didit Callback] Missing SUPABASE_SERVICE_ROLE_KEY or Supabase URL on server.');
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
 * 1. POST: Programmatic Webhook received from Didit KYC Gateway
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const rawText = await req.text();
    let payload: DiditWebhookBody = {};

    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch (parseErr) {
      console.warn('[Didit Callback] Non-JSON payload received:', rawText.slice(0, 200));
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const diditSessionId =
      payload.session_id ||
      payload.id ||
      null;

    const vendorDataUserId =
      payload.vendor_data ||
      payload.vendorData ||
      payload.userId ||
      payload.user_id ||
      payload.profile_id ||
      payload.profileId;

    const rawStatus = String(
      payload.status ||
      payload.decision ||
      payload.event ||
      payload.verification_status ||
      ''
    ).toLowerCase();

    // Check if verification succeeded
    const isApproved =
      rawStatus === 'approved' ||
      rawStatus === 'verified' ||
      rawStatus === 'completed' ||
      rawStatus === 'success' ||
      payload.verified === true;

    console.info(
      `[Didit Callback] Webhook received for User: ${vendorDataUserId}, Session: ${diditSessionId}, Status: ${rawStatus}, Approved: ${isApproved}`
    );

    if (!vendorDataUserId) {
      console.warn('[Didit Callback] Missing vendor_data (user ID) in payload.');
      return new Response(
        JSON.stringify({ error: 'Missing vendor_data user identifier' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ error: 'Supabase Service Role configuration missing on server' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (isApproved) {
      // 2. Database Update via Supabase Service Role Key
      // Privacy-First: only store kyc_verified: true, kyc_status: 'verified', and protected didit_session_id
      const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .update({
          kyc_verified: true,
          kyc_status: 'verified',
          is_verified: true,
          id_verified: true,
          selfie_verified: true,
          didit_session_id: diditSessionId,
          kyc_session_id: diditSessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendorDataUserId);

      if (dbError) {
        console.error('[Didit Callback] Error updating profile with Service Role Key:', dbError);
        return new Response(
          JSON.stringify({ success: false, error: dbError.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.info(`[Didit Callback] User ${vendorDataUserId} successfully verified with Didit Session ${diditSessionId}`);
    } else if (rawStatus === 'declined' || rawStatus === 'rejected' || rawStatus === 'failed') {
      await supabaseAdmin
        .from('profiles')
        .update({
          kyc_verified: false,
          kyc_status: 'unverified',
          didit_session_id: diditSessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendorDataUserId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: isApproved,
        session_id: diditSessionId,
        user_id: vendorDataUserId,
        status: rawStatus,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Didit Callback Exception]:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal callback error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * 2. GET: Browser Redirect URL when user finishes Didit hosted verification
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id') || url.searchParams.get('id');
  const rawStatus = (url.searchParams.get('status') || url.searchParams.get('decision') || '').toLowerCase();
  const vendorDataUserId = url.searchParams.get('vendor_data') || url.searchParams.get('userId');

  const isApproved =
    rawStatus === 'approved' ||
    rawStatus === 'verified' ||
    rawStatus === 'completed' ||
    rawStatus === 'success';

  if (isApproved && vendorDataUserId) {
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('profiles')
        .update({
          kyc_verified: true,
          kyc_status: 'verified',
          is_verified: true,
          didit_session_id: sessionId,
          kyc_session_id: sessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendorDataUserId);
    }
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    url.origin ||
    'https://daheejfree.site'
  ).replace(/\/$/, '');

  const redirectPath = isApproved
    ? `${siteUrl}/matches?kyc=verified`
    : `${siteUrl}/matches?kyc_status=${rawStatus || 'pending'}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectPath,
    },
  });
}
