// ==============================================================================
// NEXT.JS API ROUTE: FREE SUBSCRIPTION ACTIVATION (EARLY ADOPTER & 100% COUPON)
// File: src/app/api/payments/free-activation/route.ts
// Endpoint: POST /api/payments/free-activation
// ==============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/src/lib/supabase/server';
import {
  MAX_EARLY_ADOPTERS,
  getEarlyAdopterCount,
  getCoupon,
  incrementCouponUsage,
} from '@/src/lib/coupons';

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
      error: error?.message || 'Failed to fetch early adopter stats.',
      claimed_count: 0,
      remaining: MAX_EARLY_ADOPTERS,
      is_available: true,
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { tier = 'diamond', reason, couponCode } = body || {};

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const admin = createAdminClient();
    let userId = body?.userId || body?.profileId || '';

    // 1. Fetch authenticated user's ID via Supabase Auth
    if (token) {
      try {
        const {
          data: { user },
          error: authErr,
        } = await admin.auth.getUser(token);
        if (!authErr && user?.id) {
          userId = user.id;
        }
      } catch (err) {
        console.warn('[Free Activation] Supabase auth token verification note:', err);
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in to activate membership.' },
        { status: 401 }
      );
    }

    // 2. Branch: reason === 'early_adopter'
    if (reason === 'early_adopter') {
      // Check if user is already an early adopter
      const { data: profile } = await admin
        .from('profiles')
        .select('id, is_early_adopter, subscription_tier')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.is_early_adopter) {
        return NextResponse.json({
          success: true,
          alreadyClaimed: true,
          tier: 'diamond',
          is_early_adopter: true,
          message: "You have already claimed the Founder's Reward. Diamond membership is active!",
        });
      }

      // Check if COUNT(*) of profiles where is_early_adopter = true is less than 30
      const currentEarlyAdopters = await getEarlyAdopterCount();

      if (currentEarlyAdopters >= MAX_EARLY_ADOPTERS) {
        return NextResponse.json(
          {
            success: false,
            error: 'The first 30 free subscriptions have already been claimed.',
            claimed_count: currentEarlyAdopters,
            remaining: 0,
          },
          { status: 400 }
        );
      }

      // Update user's subscription_tier to 'diamond' and is_early_adopter = true
      const { error: updateErr } = await admin
        .from('profiles')
        .update({
          subscription_tier: 'diamond',
          membership_tier: 'diamond',
          subscription_status: 'active',
          is_early_adopter: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateErr) {
        console.warn('[Free Activation] DB update notice:', updateErr);
      }

      const updatedCount = currentEarlyAdopters + 1;
      const remaining = Math.max(0, MAX_EARLY_ADOPTERS - updatedCount);

      return NextResponse.json({
        success: true,
        tier: 'diamond',
        is_early_adopter: true,
        message: "🎉 Founder's Reward activated! Diamond Membership granted for being one of the first 30 users.",
        remaining,
      });
    }

    // 3. Branch: reason === 'coupon'
    if (reason === 'coupon') {
      if (!couponCode || typeof couponCode !== 'string') {
        return NextResponse.json(
          { success: false, error: 'A coupon code is required for coupon activation.' },
          { status: 400 }
        );
      }

      const cleanCode = couponCode.trim().toUpperCase();
      const coupon = await getCoupon(cleanCode);

      if (!coupon) {
        return NextResponse.json(
          { success: false, error: 'Invalid promo code.' },
          { status: 400 }
        );
      }

      if (coupon.is_active === false) {
        return NextResponse.json(
          { success: false, error: 'This promo code has been deactivated.' },
          { status: 400 }
        );
      }

      if (coupon.used_count >= coupon.max_uses) {
        return NextResponse.json(
          { success: false, error: 'Coupon expired' },
          { status: 400 }
        );
      }

      // Verify the coupon provides a 100% discount
      if (Number(coupon.discount_percent) !== 100) {
        return NextResponse.json(
          {
            success: false,
            error: `Coupon ${coupon.code} provides a ${coupon.discount_percent}% discount, not a 100% free activation.`,
          },
          { status: 400 }
        );
      }

      // Increment the coupon's used_count
      await incrementCouponUsage(coupon.code);

      // Target subscription tier (gold or diamond)
      const targetTier = String(tier || 'gold').toLowerCase();
      const finalTier = targetTier === 'diamond' ? 'diamond' : 'gold';

      // Update the user's subscription_tier
      const { error: updateErr } = await admin
        .from('profiles')
        .update({
          subscription_tier: finalTier,
          membership_tier: finalTier,
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateErr) {
        console.warn('[Free Activation] DB update notice:', updateErr);
      }

      return NextResponse.json({
        success: true,
        tier: finalTier,
        coupon_applied: coupon.code,
        message: `Alhamdulillah! 100% free activation applied with code ${coupon.code}. ${finalTier.toUpperCase()} membership is active!`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid activation reason provided. Must be "early_adopter" or "coupon".' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Free Activation API] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Free activation failed.' },
      { status: 500 }
    );
  }
}
