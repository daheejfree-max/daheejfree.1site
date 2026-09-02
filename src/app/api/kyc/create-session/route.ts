// ==============================================================================
// NEXT.JS API ROUTE: STRICT DIDIT.ME KYC SESSION GENERATOR
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request): Promise<Response> {
  const headers = { 'Content-Type': 'application/json' };

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { profileId, userId, returnUrl, features } = body;
    const targetProfileId = profileId || userId;

    if (!targetProfileId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required profileId or userId' }),
        { status: 400, headers }
      );
    }

    const diditApiKey = process.env.DIDIT_API_KEY;
    const diditClientId = process.env.DIDIT_CLIENT_ID;
    const diditWorkflowId = process.env.DIDIT_WORKFLOW_ID;
    const appUrl = process.env.APP_URL || 'https://daheejfree.site';
    const callbackUrl = returnUrl || `${appUrl}/profile?kyc_callback=true`;

    if (!diditApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Didit.me KYC API key is pending configuration on the production server. You can complete your verification instantly using the Live Webcam Biometric Selfie Check.',
        }),
        { status: 200, headers }
      );
    }

    let diditData: any = null;
    let sessionId: string | null = null;
    let sessionUrl: string | null = null;

    // 1. Try Didit v3 API
    try {
      const v3Payload: Record<string, any> = {
        vendor_data: targetProfileId,
        callback: callbackUrl,
        metadata: { profileId: targetProfileId },
      };
      if (diditWorkflowId) {
        v3Payload.workflow_id = diditWorkflowId.trim();
      }

      const v3Res = await fetch('https://verification.didit.me/v3/session/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': diditApiKey.trim(),
        },
        body: JSON.stringify(v3Payload),
      });

      const v3Text = await v3Res.text();
      try {
        const parsed = JSON.parse(v3Text);
        if (v3Res.ok && (parsed.url || parsed.session_url || parsed.verification_url)) {
          diditData = parsed;
          sessionId = parsed.session_id || parsed.id;
          sessionUrl = parsed.url || parsed.session_url || parsed.verification_url;
        }
      } catch {
        console.warn('[Didit Session Route] v3 non-JSON, trying v1 fallback...');
      }
    } catch (v3Err) {
      console.warn('[Didit Session Route] v3 error, trying v1:', v3Err);
    }

    // 2. Fallback to v1 endpoint
    if (!sessionUrl) {
      try {
        const v1Response = await fetch('https://apx.didit.me/v1/session/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${diditApiKey.trim()}`,
            'x-api-key': diditApiKey.trim(),
            ...(diditClientId ? { 'X-Client-Id': diditClientId.trim() } : {}),
          },
          body: JSON.stringify({
            vendor_data: targetProfileId,
            callback: callbackUrl,
            features: features || 'ID,OCR,LIVENESS',
          }),
        });

        const v1Text = await v1Response.text();
        try {
          diditData = JSON.parse(v1Text);
          sessionId = diditData?.session_id || diditData?.id;
          sessionUrl = diditData?.url || diditData?.session_url || diditData?.verification_url;
        } catch {
          console.warn('[Didit Session Route] v1 non-JSON response');
        }
      } catch (v1Err) {
        console.error('[Didit Session Route] v1 error:', v1Err);
      }
    }

    if (!sessionUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: diditData?.error || diditData?.message || 'Unable to initialize Didit.me verification session. Please use the Live Webcam Biometric Selfie Check below.',
          details: diditData,
        }),
        { status: 200, headers }
      );
    }

    // Persist kyc_session_id in Supabase profiles table using Service Role
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        await supabaseAdmin
          .from('profiles')
          .update({
            kyc_session_id: sessionId,
            didit_session_url: sessionUrl,
            kyc_status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetProfileId);
      } catch (dbErr) {
        console.warn('[Didit Session] Database update notice:', dbErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        sessionUrl,
        profileId: targetProfileId,
        status: 'pending',
      }),
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error('[API KYC] Session creation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to create Didit KYC session',
      }),
      { status: 500, headers }
    );
  }
}
