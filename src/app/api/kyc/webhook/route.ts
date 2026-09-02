// ==============================================================================
// NEXT.JS API ROUTE: DIDIT.ME KYC WEBHOOK RECEIVER
// ==============================================================================

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody = await request.text();
    let payload: any = {};

    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }

    const diditSignature = request.headers.get('x-didit-signature') || request.headers.get('x-signature');
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;

    // Signature verification if secret configured
    if (webhookSecret && diditSignature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== diditSignature) {
        return new Response(
          JSON.stringify({ error: 'Invalid Didit signature' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const sessionId = payload.session_id || payload.id;
    const vendorData = payload.vendor_data || payload.profile_id || payload.user_id;
    const decision = (payload.status || payload.decision || payload.event || '').toLowerCase();

    const isVerified =
      decision === 'approved' ||
      decision === 'verified' ||
      decision === 'completed' ||
      decision === 'success' ||
      payload.verification_status === 'approved';

    const kycStatus = isVerified ? 'verified' : decision.includes('reject') ? 'rejected' : 'pending';

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && (vendorData || sessionId)) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

      let query = supabaseAdmin
        .from('profiles')
        .update({
          kyc_status: kycStatus,
          updated_at: new Date().toISOString(),
        });

      if (vendorData) {
        query = query.eq('id', vendorData);
      } else if (sessionId) {
        query = query.eq('kyc_session_id', sessionId);
      }

      const { error: dbError } = await query;
      if (dbError) {
        console.error('[Didit Webhook] Supabase update error:', dbError);
      } else {
        console.info(`[Didit Webhook] Profile KYC status updated to ${kycStatus}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        received: true,
        sessionId,
        kycStatus,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Didit Webhook] Handler error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Webhook processing failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
