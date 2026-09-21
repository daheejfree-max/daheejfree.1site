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

    const profileId = body.profileId;
    const userId = body.userId;
    const returnUrl = body.returnUrl;
    const features = body.features;

    const rawSessionId =
      body.sessionId ||
      body.verificationSessionId ||
      body.verification_session_id ||
      body.session_id ||
      body.id;
    const checkOnly = Boolean(body.checkOnly);
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
    let diditWorkflowId = process.env.DIDIT_WORKFLOW_ID;
    const appUrl = process.env.APP_URL || 'https://daheejfree.site';
    const callbackUrl = returnUrl || `${appUrl}/profile?kyc_callback=true`;

    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const sessionCandidates: string[] = [];
    const addSession = (val: any) => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach((v) => addSession(v));
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed && !sessionCandidates.includes(trimmed)) {
          sessionCandidates.push(trimmed);
        }
      }
    };

    addSession(rawSessionId);
    addSession(body.sessionIds);
    addSession(body.sessionId);
    addSession(body.verificationSessionId);
    addSession(body.verification_session_id);
    addSession(body.session_id);
    addSession(body.id);

    // If checkOnly is requested but no sessionId was provided, look up from user profile in Supabase
    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('kyc_session_id, didit_session_id, kyc_status, is_verified, kyc_verified')
          .eq('id', targetProfileId)
          .maybeSingle();

        if (existingProfile?.kyc_verified || existingProfile?.kyc_status === 'verified' || existingProfile?.is_verified) {
          return new Response(
            JSON.stringify({
              success: true,
              verified: true,
              status: 'verified',
              profileId: targetProfileId,
              sessionId: existingProfile.kyc_session_id || existingProfile.didit_session_id || null,
            }),
            { status: 200, headers }
          );
        }

        addSession(existingProfile?.kyc_session_id);
        addSession(existingProfile?.didit_session_id);
      } catch (dbErr) {
        console.warn('[Didit KYC Decision] Failed to query existing profile session:', dbErr);
      }
    }

    // A. Check Decision / Verification Status for existing session(s)
    if (sessionCandidates.length > 0 || checkOnly) {
      if (!diditApiKey || sessionCandidates.length === 0) {
        // If no API key or no session yet, check if profile is already marked verified in DB
        let isDbVerified = false;
        if (supabaseUrl && serviceRoleKey) {
          try {
            const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
            const { data: dbCheck } = await supabaseAdmin
              .from('profiles')
              .select('kyc_verified, kyc_status, is_verified')
              .eq('id', targetProfileId)
              .maybeSingle();
            isDbVerified = Boolean(dbCheck?.kyc_verified || dbCheck?.kyc_status === 'verified' || dbCheck?.is_verified);
          } catch {}
        }

        return new Response(
          JSON.stringify({
            success: true,
            verified: isDbVerified,
            status: isDbVerified ? 'verified' : 'pending',
            profileId: targetProfileId,
            sessionId: sessionCandidates[sessionCandidates.length - 1] || null,
            message: isDbVerified ? 'Verified in records.' : 'Verification in progress.',
          }),
          { status: 200, headers }
        );
      }

      const reversedCandidates = [...sessionCandidates].reverse();
      let approvedSessionId: string | null = null;
      let lastDecisionData: any = null;
      let lastRawStatus = '';

      for (const candSession of reversedCandidates) {
        try {
          let decisionResponse = await fetch(
            `https://verification.didit.me/v3/session/${candSession}/decision/`,
            {
              method: 'GET',
              headers: {
                'x-api-key': diditApiKey.trim(),
              },
            }
          );

          if (!decisionResponse.ok) {
            decisionResponse = await fetch(
              `https://apx.didit.me/v1/session/${candSession}/decision/`,
              {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${diditApiKey.trim()}`,
                  ...(diditClientId ? { 'X-Client-Id': diditClientId.trim() } : {}),
                },
              }
            );
          }

          if (decisionResponse.ok) {
            const decisionText = await decisionResponse.text();
            try {
              const dData = JSON.parse(decisionText);
              lastDecisionData = dData;
              const decStatus = String(
                dData?.status || dData?.decision || dData?.verification_status || ''
              ).toLowerCase().trim();
              lastRawStatus = decStatus;
              if (
                decStatus === 'approved' ||
                decStatus === 'verified' ||
                decStatus === 'completed' ||
                decStatus === 'success'
              ) {
                approvedSessionId = candSession;
                break;
              }
            } catch {
              console.warn('[Didit KYC Decision] Upstream non-JSON for session', candSession);
            }
          }
        } catch (err) {
          console.error(`[Didit KYC Decision] Network error for session ${candSession}:`, err);
        }
      }

      const isApproved = Boolean(approvedSessionId);

      // Supabase Service Role update if verified
      if (isApproved && supabaseUrl && serviceRoleKey && approvedSessionId) {
        try {
          const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
          await supabaseAdmin
            .from('profiles')
            .update({
              kyc_verified: true,
              kyc_status: 'verified',
              is_verified: true,
              id_verified: true,
              selfie_verified: true,
              didit_session_id: approvedSessionId,
              kyc_session_id: approvedSessionId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetProfileId);

          console.info(`[Didit KYC Decision] Successfully verified profile ${targetProfileId} via session ${approvedSessionId}`);
        } catch (dbErr) {
          console.error('[Didit KYC] Supabase Admin update error:', dbErr);
        }
      }

      let finalVerified = isApproved;
      if (!finalVerified && supabaseUrl && serviceRoleKey) {
        try {
          const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
          const { data: dbCheck } = await supabaseAdmin
            .from('profiles')
            .select('kyc_verified, kyc_status, is_verified')
            .eq('id', targetProfileId)
            .maybeSingle();
          if (dbCheck?.kyc_verified || dbCheck?.kyc_status === 'verified' || dbCheck?.is_verified) {
            finalVerified = true;
          }
        } catch {}
      }

      return new Response(
        JSON.stringify({
          success: true,
          verified: finalVerified,
          status: finalVerified
            ? 'verified'
            : lastRawStatus === 'rejected' || lastRawStatus === 'declined'
            ? 'unverified'
            : 'pending',
          profileId: targetProfileId,
          sessionId: approvedSessionId || reversedCandidates[0] || null,
          decision: lastDecisionData,
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
        callback: callbackUrl,
        metadata: { profileId: targetProfileId },
      };
      if (diditWorkflowId) {
        v3Payload.workflow_id = diditWorkflowId.trim();
      }

      const v3Response = await fetch('https://verification.didit.me/v3/session/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': diditApiKey.trim(),
        },
        body: JSON.stringify(v3Payload),
      });

      const v3Text = await v3Response.text();
      try {
        sessionData = JSON.parse(v3Text);
        if (v3Response.ok && (sessionData.url || sessionData.session_url || sessionData.verification_url)) {
          sessionId = sessionData.session_id || sessionData.id;
          sessionUrl = sessionData.url || sessionData.session_url || sessionData.verification_url;
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
          sessionData = JSON.parse(v1Text);
          sessionId = sessionData?.session_id || sessionData?.id;
          sessionUrl = sessionData?.url || sessionData?.session_url || sessionData?.verification_url;
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
