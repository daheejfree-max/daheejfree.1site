// ==============================================================================
// NEXT.JS APP ROUTER: STRICT PRODUCTION KYC VERIFICATION ROUTE
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

    const { profileId, userId, sessionId: sessionIdQuery, returnUrl, features } = body;
    const targetProfileId = profileId || userId;

    if (!targetProfileId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameter: profileId or userId.',
        }),
        { status: 400, headers }
      );
    }

    const diditApiKey = process.env.DIDIT_API_KEY;
    const diditClientId = process.env.DIDIT_CLIENT_ID;
    const diditWorkflowId = process.env.DIDIT_WORKFLOW_ID;
    const appUrl = process.env.APP_URL || 'https://daheejfree.site';
    const callbackUrl = returnUrl || `${appUrl}/profile?kyc_callback=true`;

    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // A. Check Decision / Verification Status for an existing session
    if (sessionIdQuery) {
      if (!diditApiKey) {
        return new Response(
          JSON.stringify({
            success: true,
            status: 'pending',
            profileId: targetProfileId,
            sessionId: sessionIdQuery,
            message: 'Verification in progress.',
          }),
          { status: 200, headers }
        );
      }

      let decisionData: any = null;
      try {
        let decisionResponse = await fetch(
          `https://verification.didit.me/v3/session/${sessionIdQuery}/decision/`,
          {
            method: 'GET',
            headers: {
              'x-api-key': diditApiKey,
              Authorization: `Bearer ${diditApiKey}`,
              ...(diditClientId ? { 'X-Client-Id': diditClientId } : {}),
            },
          }
        );

        if (!decisionResponse.ok) {
          decisionResponse = await fetch(
            `https://apx.didit.me/v1/session/${sessionIdQuery}/decision/`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${diditApiKey}`,
                ...(diditClientId ? { 'X-Client-Id': diditClientId } : {}),
              },
            }
          );
        }

        const decisionText = await decisionResponse.text();
        try {
          decisionData = JSON.parse(decisionText);
        } catch {
          console.warn('[Didit KYC Decision] Upstream non-JSON');
        }
      } catch (err) {
        console.error('[Didit KYC Decision] Network error:', err);
      }

      const status = (decisionData?.status || decisionData?.decision || '').toLowerCase();
      const isApproved =
        status === 'approved' ||
        status === 'verified' ||
        status === 'completed' ||
        status === 'success';

      // Supabase Service Role update if verified
      if (isApproved && supabaseUrl && serviceRoleKey) {
        try {
          const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
          await supabaseAdmin
            .from('profiles')
            .update({
              kyc_verified: true,
              kyc_status: 'verified',
              is_verified: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetProfileId);
        } catch (dbErr) {
          console.error('[Didit KYC] Supabase Admin update error:', dbErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          verified: isApproved,
          status: isApproved
            ? 'verified'
            : status === 'rejected' || status === 'declined'
            ? 'unverified'
            : 'pending',
          profileId: targetProfileId,
          sessionId: sessionIdQuery,
          decision: decisionData,
        }),
        { status: 200, headers }
      );
    }

    // B. Create New Session
    if (!diditApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Didit.me KYC API key is pending configuration. You can complete your verification instantly using the Live Webcam Biometric Selfie Check below.',
        }),
        { status: 200, headers }
      );
    }

    let sessionData: any = null;
    let sessionId: string | null = null;
    let sessionUrl: string | null = null;

    // 1. Try Didit v3
    try {
      const v3Payload: Record<string, any> = {
        vendor_data: targetProfileId,
        callback: `${appUrl}/api/kyc/webhook`,
        redirect_url: callbackUrl,
        metadata: { profileId: targetProfileId },
      };
      if (diditWorkflowId) {
        v3Payload.workflow_id = diditWorkflowId;
      }

      const v3Response = await fetch('https://verification.didit.me/v3/session/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': diditApiKey,
          Authorization: `Bearer ${diditApiKey}`,
        },
        body: JSON.stringify(v3Payload),
      });

      const v3Text = await v3Response.text();
      try {
        sessionData = JSON.parse(v3Text);
        if (v3Response.ok && (sessionData.url || sessionData.session_url)) {
          sessionId = sessionData.session_id || sessionData.id;
          sessionUrl = sessionData.url || sessionData.session_url;
        }
      } catch {
        console.warn('[Didit v3 Route] Non-JSON, trying v1...');
      }
    } catch (v3Err) {
      console.warn('[Didit v3 Route] Exception, trying v1:', v3Err);
    }

    // 2. Fallback to v1
    if (!sessionUrl) {
      try {
        const v1Response = await fetch('https://apx.didit.me/v1/session/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${diditApiKey}`,
            ...(diditClientId ? { 'X-Client-Id': diditClientId } : {}),
          },
          body: JSON.stringify({
            vendor_data: targetProfileId,
            callback: `${appUrl}/api/kyc/webhook`,
            redirect_url: callbackUrl,
            features: features || 'ID,OCR,LIVENESS',
          }),
        });

        const v1Text = await v1Response.text();
        try {
          sessionData = JSON.parse(v1Text);
          sessionId = sessionData?.session_id || sessionData?.id;
          sessionUrl = sessionData?.url || sessionData?.session_url;
        } catch {
          console.warn('[Didit v1 Route] Non-JSON response');
        }
      } catch (v1Err) {
        console.error('[Didit v1 Route] Exception:', v1Err);
      }
    }

    if (!sessionUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            sessionData?.error ||
            sessionData?.message ||
            'Unable to initialize Didit.me verification session. Please use the Live Webcam Biometric Selfie Check below.',
          details: sessionData,
        }),
        { status: 200, headers }
      );
    }

    // Update profile with pending session
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
        console.warn('[Didit KYC] Notice updating session in database:', dbErr);
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
    console.error('[App Router KYC Verify Error]:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error during KYC verification.',
      }),
      { status: 500, headers }
    );
  }
}
