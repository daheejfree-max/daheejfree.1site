// ==============================================================================
// STRICT PRODUCTION KYC VERIFICATION HANDLER (DIDIT.ME & SUPABASE SERVICE ROLE)
// ==============================================================================

import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export interface KYCVerificationRequest {
  profileId?: string;
  userId?: string;
  sessionId?: string;
  returnUrl?: string;
  features?: string;
}

export interface KYCVerificationSuccessResponse {
  success: true;
  status: string;
  verified?: boolean;
  sessionId?: string;
  sessionUrl?: string;
  profileId?: string;
  decision?: unknown;
  message?: string;
}

export interface KYCVerificationErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export type KYCVerificationResponse =
  | KYCVerificationSuccessResponse
  | KYCVerificationErrorResponse;

/**
 * Production-ready KYC verification handler:
 * - Enforces immediate JSON headers
 * - Supports Didit v3 & v1
 * - Defensively reads upstream text then safely JSON.parse()
 * - Leverages SUPABASE_SERVICE_ROLE_KEY for privileged profiles table updates
 * - Clean catch-all error boundary
 */
export async function kycVerifyHandler(
  req: Request | any,
  res: Response | any
): Promise<void> {
  // 1. Enforce JSON Header Immediately
  res.setHeader('Content-Type', 'application/json');

  try {
    const body: KYCVerificationRequest = req.body || {};
    const query = req.query || {};
    const profileId = body.profileId || body.userId || query.profileId || query.userId;
    const sessionIdQuery = body.sessionId || query.sessionId;
    const returnUrl = body.returnUrl || query.returnUrl;
    const features = body.features || 'ID,OCR,LIVENESS';

    if (!profileId) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameter: profileId or userId.',
      });
      return;
    }

    const diditApiKey = process.env.DIDIT_API_KEY;
    const diditClientId = process.env.DIDIT_CLIENT_ID;
    let diditWorkflowId = process.env.DIDIT_WORKFLOW_ID;
    const appUrl =
      process.env.APP_URL ||
      (req.headers?.origin as string) ||
      'https://daheejfree.site';
    const callbackUrl = returnUrl || `${appUrl}/profile?kyc_callback=true`;

    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // A. Check Decision / Verification Status for an existing session
    if (sessionIdQuery) {
      if (!diditApiKey) {
        res.status(200).json({
          success: true,
          status: 'pending',
          profileId,
          sessionId: sessionIdQuery,
          message: 'Verification in progress.',
        });
        return;
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

      // Service Role Database Update
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
            .eq('id', profileId);
        } catch (dbErr) {
          console.error('[Didit KYC] Supabase Admin update error:', dbErr);
        }
      }

      res.status(200).json({
        success: true,
        verified: isApproved,
        status: isApproved
          ? 'verified'
          : status === 'rejected' || status === 'declined'
          ? 'unverified'
          : 'pending',
        profileId,
        sessionId: sessionIdQuery,
        decision: decisionData,
      });
      return;
    }

    // B. Create New Verification Session
    if (!diditApiKey) {
      res.status(200).json({
        success: false,
        error:
          'Didit.me KYC API key is pending configuration. You can complete your verification instantly using the Live Webcam Biometric Selfie Check below.',
      });
      return;
    }

    let sessionData: any = null;
    let sessionId: string | null = null;
    let sessionUrl: string | null = null;

    // 1. Try Didit v3
    try {
      const v3Payload: Record<string, any> = {
        vendor_data: profileId,
        callback: callbackUrl,
        metadata: { profileId },
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
        console.warn('[Didit v3 Handler] Non-JSON response, falling back to v1');
      }
    } catch (v3Err) {
      console.warn('[Didit v3 Handler] Error:', v3Err);
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
            vendor_data: profileId,
            callback: callbackUrl,
            features,
          }),
        });

        const v1Text = await v1Response.text();
        try {
          sessionData = JSON.parse(v1Text);
          sessionId = sessionData?.session_id || sessionData?.id;
          sessionUrl = sessionData?.url || sessionData?.session_url || sessionData?.verification_url;
        } catch {
          console.warn('[Didit v1 Handler] Non-JSON response');
        }
      } catch (v1Err) {
        console.error('[Didit v1 Handler] Error:', v1Err);
      }
    }

    if (!sessionUrl) {
      res.status(200).json({
        success: false,
        error:
          sessionData?.error ||
          sessionData?.message ||
          'Unable to initialize Didit.me verification session. Please use the Live Webcam Biometric Selfie Check below.',
        details: sessionData,
      });
      return;
    }

    // Persist session info to user profile via Supabase Service Role
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
          .eq('id', profileId);
      } catch (dbErr) {
        console.warn('[Didit KYC] Notice updating session in database:', dbErr);
      }
    }

    res.status(200).json({
      success: true,
      sessionId,
      sessionUrl,
      profileId,
      status: 'pending',
    });
  } catch (error: any) {
    console.error('[API KYC Verify Handler Error]:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error during KYC verification.',
    });
  }
}

export default kycVerifyHandler;
