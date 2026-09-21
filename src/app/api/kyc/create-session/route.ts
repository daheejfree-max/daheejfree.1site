// ==============================================================================
// DIDIT.ME KYC SESSION CREATION API ROUTE (v3)
// ==============================================================================

export async function POST(request: Request): Promise<Response> {
  try {
    // 1. Retrieve and validate required Didit credentials from environment
    const diditApiKey = process.env.DIDIT_API_KEY;
    const diditWorkflowId = process.env.DIDIT_WORKFLOW_ID;

    if (!diditApiKey) {
      console.error('[Didit KYC] Server misconfiguration: DIDIT_API_KEY is missing from environment variables.');
      return Response.json(
        { success: false, error: 'Server configuration error: DIDIT_API_KEY is not set.' },
        { status: 500 }
      );
    }

    if (!diditWorkflowId) {
      console.error('[Didit KYC] Server misconfiguration: DIDIT_WORKFLOW_ID is missing from environment variables.');
      return Response.json(
        { success: false, error: 'Server configuration error: DIDIT_WORKFLOW_ID is not set.' },
        { status: 500 }
      );
    }

    // 2. Parse request body to extract the Supabase user ID
    let body: any = {};
    try {
      const rawText = await request.text();
      body = rawText ? JSON.parse(rawText) : {};
    } catch {
      body = {};
    }

    const userId =
      body.userId ||
      body.user_id ||
      body.vendor_data ||
      body.vendorData ||
      body.profileId ||
      body.id;

    if (!userId) {
      console.error('[Didit KYC] Validation error: Missing user ID in request body.');
      return Response.json(
        { success: false, error: 'Missing required Supabase user ID (vendor_data) to create KYC session.' },
        { status: 400 }
      );
    }

    // Optional return/callback URL for redirect after verification
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://daheejfree.site'
    ).replace(/\/$/, '');

    const callbackUrl = body.callbackUrl || body.returnUrl || `${siteUrl}/api/kyc/didit-callback`;

    // 3. Construct the exact JSON payload required by Didit v3 API
    // Must include workflow_id and vendor_data (Supabase user.id)
    const diditPayload: Record<string, any> = {
      workflow_id: diditWorkflowId.trim(),
      vendor_data: String(userId).trim(),
    };

    if (callbackUrl) {
      diditPayload.callback = callbackUrl;
    }

    // 4. Make POST request to https://verification.didit.me/v3/session/
    const response = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: {
        'x-api-key': diditApiKey.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(diditPayload),
    });

    // 5. Strict error handling: Log await response.text() if Didit API returns 400/500
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Didit KYC API Error] Status: ${response.status} ${response.statusText}. Response:`, errorText);

      let parsedError: any = null;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = null;
      }

      return Response.json(
        {
          success: false,
          error: parsedError?.message || parsedError?.error || `Didit API rejected session creation with status ${response.status}.`,
          status: response.status,
          details: parsedError || errorText,
        },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 }
      );
    }

    // 6. Parse successful JSON response from Didit
    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Didit KYC API Error] Failed to parse successful JSON response from Didit:', responseText);
      return Response.json(
        { success: false, error: 'Invalid JSON response received from Didit API.', raw: responseText },
        { status: 502 }
      );
    }

    // Didit returns 'url' as the hosted verification link
    const verificationUrl = data.url || data.session_url || data.verification_url;

    if (!verificationUrl) {
      console.error('[Didit KYC API Error] Didit response did not contain a verification URL:', data);
      return Response.json(
        { success: false, error: 'Didit session created but no verification URL was returned.', details: data },
        { status: 502 }
      );
    }

    // Return the URL to the frontend so client can redirect: window.location.href = data.url
    return Response.json({
      success: true,
      url: verificationUrl,
      session_url: verificationUrl,
      sessionId: data.session_id || data.id,
      vendor_data: String(userId),
      data,
    });
  } catch (error: any) {
    console.error('[Didit KYC API Error] Unhandled exception in create-session route:', error);
    return Response.json(
      { success: false, error: error?.message || 'Internal server error while creating Didit KYC session.' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  });
}
