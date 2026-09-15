// ==============================================================================
// DIDIT.ME KYC WEBHOOK & USER CALLBACK ROUTE
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const NextResponse = {
  json: (body: any, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    }),
  redirect: (url: string, status = 302) =>
    new Response(null, {
      status,
      headers: { Location: url },
    }),
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// 1. POST: Webhook receiver from Didit KYC gateway
export async function POST(request: Request): Promise<Response> {
  try {
    const rawText = await request.text();
    let payload: any = {};
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = {};
    }

    const vendorDataUserId =
      payload.vendor_data ||
      payload.vendorData ||
      payload.userId ||
      payload.user_id ||
      payload.profile_id ||
      payload.profileId;

    const status = (payload.status || payload.decision || payload.event || '').toLowerCase();
    const isApproved =
      status === 'approved' ||
      status === 'verified' ||
      status === 'completed' ||
      status === 'success' ||
      payload.verification_status === 'approved' ||
      payload.verified === true;

    if (isApproved && vendorDataUserId) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            kyc_verified: true,
            kyc_status: 'verified',
            id_verified: true,
            selfie_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', String(vendorDataUserId));

        if (error) {
          console.error('[KYC Callback POST] Supabase Admin update error:', error);
        } else {
          console.info(`[KYC Callback POST] Profile ${vendorDataUserId} KYC verified successfully.`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      verified: isApproved,
      vendorDataUserId,
      status,
    });
  } catch (error: any) {
    console.error('[KYC Callback POST] Unexpected error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process KYC callback' },
      { status: 500 }
    );
  }
}

// 2. GET: Browser redirect when candidate completes verification portal
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://daheejfree.site'
  ).replace(/\/$/, '');

  try {
    const vendorDataUserId =
      url.searchParams.get('vendor_data') ||
      url.searchParams.get('vendorData') ||
      url.searchParams.get('userId') ||
      url.searchParams.get('profileId') ||
      url.searchParams.get('user_id');

    const status = (url.searchParams.get('status') || url.searchParams.get('decision') || '').toLowerCase();
    const isApproved =
      status === 'approved' ||
      status === 'verified' ||
      status === 'completed' ||
      status === 'success';

    if (isApproved && vendorDataUserId) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('profiles')
          .update({
            kyc_verified: true,
            kyc_status: 'verified',
            id_verified: true,
            selfie_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', String(vendorDataUserId));
      }
    }

    // Redirect user back to profile or matches with verification success banner
    const redirectTarget = isApproved
      ? `${siteUrl}/profile?kyc_verified=true&refresh=true`
      : `${siteUrl}/profile?kyc_callback=done&refresh=true`;

    return NextResponse.redirect(redirectTarget);
  } catch (err) {
    console.error('[KYC Callback GET] Error in browser redirect:', err);
    return NextResponse.redirect(`${siteUrl}/profile?kyc_callback=done`);
  }
}
