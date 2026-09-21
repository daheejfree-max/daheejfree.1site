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

export async function POST(request: Request): Promise<Response> {
  try {
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

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://daheejfree.site'
    ).replace(/\/$/, '');

    const callbackUrl = body.callbackUrl || body.returnUrl || `${siteUrl}/api/kyc/didit-callback`;

    const diditPayload: Record<string, any> = {
      workflow_id: diditWorkflowId.trim(),
      vendor_data: String(userId).trim(),
    };

    if (callbackUrl) {
      diditPayload.callback = callbackUrl;
    }

    const response = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: {
        'x-api-key': diditApiKey.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(diditPayload),
    });

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

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Didit KYC API Error] Failed to parse response:', responseText);
      return Response.json(
        { success: false, error: 'Invalid JSON response received from Didit API.', raw: responseText },
        { status: 502 }
      );
    }

    const verificationUrl = data.url || data.session_url || data.verification_url;

    if (!verificationUrl) {
      return Response.json(
        { success: false, error: 'Didit session created but no verification URL was returned.', details: data },
        { status: 502 }
      );
    }

    return Response.json({
      success: true,
      url: verificationUrl,
      session_url: verificationUrl,
      sessionId: data.session_id || data.id,
      vendor_data: String(userId),
      data,
    });
  } catch (error: any) {
    console.error('[Didit KYC API Error] Unhandled exception:', error);
    return Response.json(
      { success: false, error: error?.message || 'Internal server error while creating Didit KYC session.' },
      { status: 500 }
    );
  }
}

export default async function handler(req: any, res: any) {
  if (req instanceof Request || (req && typeof req.headers?.get === 'function')) {
    if (req.method === 'OPTIONS') return OPTIONS();
    return POST(req);
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const url = `${protocol}://${host}${req.url || '/api/kyc/create-session'}`;

      let bodyData = req.body;
      if (typeof bodyData !== 'string') {
        bodyData = JSON.stringify(bodyData || {});
      }

      const webReq = new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(req.headers['authorization'] ? { authorization: req.headers['authorization'] } : {}),
        },
        body: bodyData,
      });

      const webRes = await POST(webReq);
      const data = await webRes.json();
      return res.status(webRes.status).json(data);
    } catch (err: any) {
      console.error('[Vercel /api/kyc/create-session error]:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to create KYC session' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
