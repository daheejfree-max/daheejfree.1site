// ==============================================================================
// SECURE ADMIN ACTION API ROUTE (Next.js App Router)
// Protected with SUPABASE_SERVICE_ROLE_KEY & Strict Admin Identity Verification
// ==============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export type AdminActionType =
  | 'verify_kyc'
  | 'grant_subscription'
  | 'ban_user'
  | 'unban_user';

interface AdminActionRequest {
  action: AdminActionType;
  targetUserId: string;
  payload?: any;
}

export async function POST(req: Request) {
  try {
    // 1. Explicitly check for process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Admin API Error: SUPABASE_SERVICE_ROLE_KEY is missing from environment.');
      return NextResponse.json(
        { error: 'Server misconfiguration: Missing service role key' },
        { status: 500 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '';

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Server misconfiguration: Missing Supabase URL' },
        { status: 500 }
      );
    }

    // Initialize elevated Supabase Admin client using SUPABASE_SERVICE_ROLE_KEY
    const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 2. Extract Bearer token from Authorization header or cookie
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    let token = '';

    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // Fallback: Check cookies for Supabase auth token
    if (!token) {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch =
        cookieHeader.match(/sb-[^;]+-auth-token=([^;]+)/) ||
        cookieHeader.match(/supabase-auth-token=([^;]+)/) ||
        cookieHeader.match(/sb-access-token=([^;]+)/);
      if (tokenMatch && tokenMatch[1]) {
        try {
          const decoded = decodeURIComponent(tokenMatch[1]);
          const parsed = JSON.parse(decoded);
          token = Array.isArray(parsed) ? parsed[0] : parsed.access_token || parsed;
        } catch {
          token = decodeURIComponent(tokenMatch[1]);
        }
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing Bearer authentication token.' },
        { status: 401 }
      );
    }

    // 3. Verify Bearer token with Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or expired session token.' },
        { status: 401 }
      );
    }

    const requesterUserId = authData.user.id;
    const requesterEmail = authData.user.email?.toLowerCase();

    // 4. Query public.profiles to verify is_admin === true
    const { data: requesterProfile } = await adminClient
      .from('profiles')
      .select('id, is_admin, full_name, kyc_status')
      .eq('id', requesterUserId)
      .maybeSingle();

    const isDesignatedEmail =
      requesterEmail === 'behumble7860@gmail.com' ||
      requesterEmail === 'hasnainkhan3177@gmail.com';

    const isVerifiedAdmin = Boolean(requesterProfile?.is_admin || isDesignatedEmail);

    if (!isVerifiedAdmin) {
      console.warn(`[Admin API] Unauthorized access attempt by user ${requesterUserId} (${requesterEmail})`);
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required.' },
        { status: 403 }
      );
    }

    // Auto-sync is_admin in database if designated superadmin
    if (isDesignatedEmail && !requesterProfile?.is_admin) {
      await adminClient
        .from('profiles')
        .update({ is_admin: true, is_active: true })
        .eq('id', requesterUserId);
    }

    // 5. Parse & Validate Payload
    let body: AdminActionRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload in request body.' },
        { status: 400 }
      );
    }

    const { action, targetUserId, payload } = body;

    if (!action || !targetUserId) {
      return NextResponse.json(
        { error: 'Missing required fields: action and targetUserId are mandatory.' },
        { status: 400 }
      );
    }

    // Check target profile existence
    const { data: targetProfile, error: targetFindError } = await adminClient
      .from('profiles')
      .select('id, full_name, kyc_status, is_active, subscription_tier')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetFindError || !targetProfile) {
      return NextResponse.json(
        { error: `Target user with ID '${targetUserId}' does not exist.` },
        { status: 404 }
      );
    }

    // 6. Execute Admin Action
    let updateFields: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    let successMessage = '';

    switch (action) {
      case 'verify_kyc':
        updateFields = {
          ...updateFields,
          kyc_verified: true,
          kyc_status: 'verified',
          id_verified: true,
          is_verified: true,
          selfie_verified: true,
        };
        successMessage = `KYC verified successfully for user ${targetProfile.full_name || targetUserId}.`;
        break;

      case 'grant_subscription': {
        const rawTier = typeof payload === 'string' ? payload : payload?.tier;
        const targetTier = String(rawTier || 'gold').toLowerCase().trim();
        const allowedTiers = ['free', 'gold', 'diamond', 'platinum'];

        if (!allowedTiers.includes(targetTier)) {
          return NextResponse.json(
            {
              error: `Invalid subscription tier '${targetTier}'. Allowed: ${allowedTiers.join(', ')}`,
            },
            { status: 400 }
          );
        }

        updateFields = {
          ...updateFields,
          subscription_tier: targetTier,
          membership_tier: targetTier,
          subscription_status: 'active',
        };
        successMessage = `Subscription tier set to '${targetTier}' for user ${targetProfile.full_name || targetUserId}.`;
        break;
      }

      case 'ban_user':
        updateFields = {
          ...updateFields,
          is_active: false,
          kyc_status: 'banned',
        };
        successMessage = `User ${targetProfile.full_name || targetUserId} has been banned and suspended.`;
        break;

      case 'unban_user':
        updateFields = {
          ...updateFields,
          is_active: true,
          kyc_status: targetProfile.kyc_status === 'banned' ? 'verified' : targetProfile.kyc_status,
        };
        successMessage = `User ${targetProfile.full_name || targetUserId} has been reactivated and unbanned.`;
        break;

      default:
        return NextResponse.json(
          {
            error: `Unsupported admin action '${action}'. Supported: verify_kyc, grant_subscription, ban_user, unban_user.`,
          },
          { status: 400 }
        );
    }

    // 7. Perform the database update on public.profiles
    const { data: updatedData, error: updateError } = await adminClient
      .from('profiles')
      .update(updateFields)
      .eq('id', targetUserId)
      .select('*')
      .single();

    if (updateError) {
      console.error('[Admin Action Error] Database update failed:', updateError);
      return NextResponse.json(
        { error: `Database update failed: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: successMessage,
      action,
      targetUserId,
      profile: updatedData,
    });
  } catch (error: any) {
    console.error('Admin API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
