// ==============================================================================
// NEXT.JS API ROUTE: FIRST 30 USERS FREE EARLY ADOPTER CLAIM
// File: src/app/api/payments/claim-early-access/route.ts
// Endpoint: POST /api/payments/claim-early-access
// ==============================================================================

import { NextResponse } from 'next/server';
import { claimEarlyAccess, getEarlyAdopterCount, MAX_EARLY_ADOPTERS } from '@/src/lib/coupons';
import { createAdminClient } from '@/src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const claimedCount = await getEarlyAdopterCount();
    const remaining = Math.max(0, MAX_EARLY_ADOPTERS - claimedCount);
    return NextResponse.json({
      success: true,
      claimed_count: claimedCount,
      max_early_adopters: MAX_EARLY_ADOPTERS,
      remaining,
      is_available: claimedCount < MAX_EARLY_ADOPTERS,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to check early adopter spots.',
      remaining: 0,
      is_available: false,
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    let targetUserId = body?.userId || body?.profileId || '';

    // Verify user authentication via Supabase Auth if token present
    if (token) {
      try {
        const admin = createAdminClient();
        const { data: { user }, error: authErr } = await admin.auth.getUser(token);
        if (!authErr && user?.id) {
          targetUserId = user.id;
        }
      } catch (err) {
        console.warn('[EarlyAccess] Token validation note:', err);
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in to claim your early access perk.' },
        { status: 401 }
      );
    }

    const result = await claimEarlyAccess(targetUserId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'The first 30 free subscriptions have already been claimed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      alreadyClaimed: result.alreadyClaimed || false,
      remaining: result.remaining,
      tier: 'gold',
    });
  } catch (error: any) {
    console.error('[EarlyAccess API] Claim error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to claim early adopter perk.' },
      { status: 500 }
    );
  }
}
