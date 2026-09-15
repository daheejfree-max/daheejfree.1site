// ==============================================================================
// DIDIT.ME KYC SESSION CREATION API ROUTE
// ==============================================================================

// Helper for Next.js / Web-compatible JSON response
const NextResponse = {
  json: (body: any, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    }),
};

export async function POST(request: Request): Promise<Response> {
  try {
    // 1. Secure server-side validation of DIDIT_API_KEY
    const diditApiKey = process.env.DIDIT_API_KEY;
    if (!diditApiKey) {
      return NextResponse.json(
        { error: 'KYC configuration missing on server.' },
        { status: 500 }
      );
    }

    // 2. Parse request body safely
    let body: any = {};
    try {
      const rawBody = await request.text();
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      body = {};
    }

    const userId = body.userId || body.profileId || body.user_id || body.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required user/profile ID.' },
        { status: 400 }
      );
    }

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://daheejfree.site'
    ).replace(/\/$/, '');

    const callbackUrl = `${siteUrl}/api/kyc/callback`;

    // 3. Call Didit's v2 session API to generate a hosted verification link
    const diditPayload = {
      callback: callbackUrl,
      vendor_data: String(userId),
    };

    const res = await fetch('https://apx.didit.me/auth/v2/session/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${diditApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(diditPayload),
    });

    // 4. Safe text-parser to prevent JSON parse crashes on HTML error pages
    const rawText = await res.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid response from Didit gateway', raw: rawText.slice(0, 300) },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || data?.message || 'Failed to create KYC session with Didit gateway', details: data },
        { status: res.status }
      );
    }

    const verificationUrl = data.url || data.session_url || data.verification_url;
    return NextResponse.json({
      success: true,
      url: verificationUrl,
      session_url: verificationUrl,
      sessionId: data.session_id || data.id,
      data,
    });
  } catch (error: any) {
    console.error('[KYC create-session] Unhandled server error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error while creating KYC session.' },
      { status: 500 }
    );
  }
}
