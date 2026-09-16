import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

// ==============================================================================
// NEXT.JS SUPABASE SSR AUTH CALLBACK ROUTE HANDLER (src/app/auth/callback/route.ts)
// Extracts OAuth code & next path, exchanges for session, and sets cookies
// ==============================================================================

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    // Fallback to /matches if next parameter is not provided
    const next = requestUrl.searchParams.get('next') || '/matches';

    // Error Catch 1: If code is missing, Supabase sent implicit hash or missing param
    if (!code) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${requestUrl.origin}/login?error=NO_CODE_PROVIDED_CHECK_FRONTEND_PKCE`,
        },
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    const cookiesToSetList: Array<{ name: string; value: string; options?: CookieOptions }> = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      },
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get('cookie') || '';
          return cookieHeader
            .split(';')
            .map((c) => {
              const [name, ...val] = c.trim().split('=');
              return { name, value: val.join('=') };
            })
            .filter((c) => Boolean(c.name));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => cookiesToSetList.push(c));
        },
      },
    });

    // Exchange authentication code for active session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // Error Catch 2: If code exchange fails, return specific error
    if (error) {
      console.error('[Auth Callback] Code exchange raw error:', error);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${requestUrl.origin}/login?error=EXCHANGE_FAILED_${encodeURIComponent(error.message)}`,
        },
      });
    }

    // Gracefully ensure the profiles row exists with safe OAuth metadata extraction & defaults
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('[Auth Callback] getUser error:', userError);
      } else if (userData?.user) {
        const user = userData.user;
        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          'New User';
        const avatarUrl =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null;
        const gender = user.user_metadata?.gender || 'female';
        const role = user.user_metadata?.role || 'candidate';
        const phone = user.user_metadata?.phone || null;

        const forwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || 'Unknown');

        const { error: profileUpsertError } = await supabase.from('profiles').upsert(
          {
            id: user.id,
            full_name: fullName,
            avatar_url: avatarUrl,
            gender: gender,
            role: role,
            phone_number: phone,
            location: user.user_metadata?.location || 'Hyderabad, TS',
            profession: user.user_metadata?.profession || 'Professional',
            wali_email: user.email,
            // Legal consent: do NOT insert null. Let database defaults (false) apply unless explicitly accepted in metadata
            ...(user.user_metadata?.anti_dowry_pledged === true ? { anti_dowry_pledged: true } : {}),
            ...(user.user_metadata?.terms_accepted === true ? { terms_accepted: true } : {}),
            ...(user.user_metadata?.privacy_policy_accepted === true ? { privacy_policy_accepted: true } : {}),
            kyc_status: 'verified',
            last_known_ip: clientIp,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id', ignoreDuplicates: false }
        );

        if (profileUpsertError) {
          console.error('[Auth Callback] Supabase profiles upsert raw error:', profileUpsertError);
        }
      }
    } catch (profileException) {
      console.error('[Auth Callback] Profile creation exception:', profileException);
    }

    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';
    const redirectUrl = isLocalEnv
      ? `${requestUrl.origin}${next}`
      : forwardedHost
      ? `https://${forwardedHost}${next}`
      : `${requestUrl.origin}${next}`;

    const headers = new Headers();
    headers.set('Location', redirectUrl);

    // Attach session cookies for Server-Side Rendering
    cookiesToSetList.forEach(({ name, value, options }) => {
      let cookieStr = `${name}=${value}; Path=/; SameSite=None; Secure`;
      if (options?.maxAge) cookieStr += `; Max-Age=${options.maxAge}`;
      if (options?.httpOnly) cookieStr += '; HttpOnly';
      headers.append('Set-Cookie', cookieStr);
    });

    // Set daheej_auth_session cookie for middleware and store synchronization
    headers.append(
      'Set-Cookie',
      `daheej_auth_session=true; Path=/; SameSite=None; Secure; Max-Age=604800`
    );

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (err: any) {
    console.error('[Auth Callback] Exception during callback processing:', err);
    const fallbackOrigin = typeof request?.url === 'string' ? new URL(request.url).origin : '';
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${fallbackOrigin || ''}/login?error=EXCHANGE_FAILED_${encodeURIComponent(err?.message || 'UNKNOWN_ERROR')}`,
      },
    });
  }
}

