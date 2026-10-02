// ==============================================================================
// NEXT.JS API ROUTE: PROMO COUPON VALIDATION
// File: src/app/api/coupons/validate/route.ts
// Endpoint: POST /api/coupons/validate
// ==============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/src/lib/supabase/server';
import { IN_MEMORY_COUPONS } from '@/src/lib/coupons';
import { SUBSCRIPTION_PLANS } from '@/src/lib/dodoPayments';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, tier = 'gold', billingCycle = 'monthly' } = body || {};

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { valid: false, error: 'Please enter a promo code.' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();
    let coupon: {
      code: string;
      discount_percent: number;
      max_uses: number;
      used_count: number;
      tier_allowed: string;
      is_active?: boolean;
      expires_at?: string | null;
    } | null = null;

    // 1. Query Supabase `coupons` table where `code = code` and `is_active = true`
    try {
      const admin = createAdminClient();
      const queryPromise = admin
        .from('coupons')
        .select('*')
        .ilike('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('DB timeout') }), 1200)
      );

      const { data } = await Promise.race([queryPromise, timeoutPromise]);

      if (data) {
        coupon = {
          code: data.code.toUpperCase(),
          discount_percent: Number(data.discount_percent),
          max_uses: Number(data.max_uses),
          used_count: Number(data.used_count || 0),
          tier_allowed: data.tier_allowed || 'all',
          is_active: Boolean(data.is_active),
          expires_at: data.expires_at,
        };
      }
    } catch (err) {
      console.warn('[Coupons API] DB lookup note:', err);
    }

    // Fallback to in-memory coupon definitions if DB did not return
    if (!coupon && IN_MEMORY_COUPONS[cleanCode]) {
      coupon = { ...IN_MEMORY_COUPONS[cleanCode] };
    }

    if (!coupon) {
      return NextResponse.json(
        { valid: false, error: 'Invalid promo code.' },
        { status: 400 }
      );
    }

    // 2. Check if coupon is expired due to usage limit
    if (coupon.used_count >= coupon.max_uses) {
      return NextResponse.json(
        { valid: false, error: 'Coupon expired' },
        { status: 400 }
      );
    }

    // Check expiration date if present
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { valid: false, error: 'Coupon expired' },
        { status: 400 }
      );
    }

    // Check tier compatibility only if tier was explicitly provided by caller
    const targetTier = String(body?.tier || tier || 'diamond').toLowerCase();
    if (body?.tier) {
      if (coupon.tier_allowed !== 'all' && coupon.tier_allowed.toLowerCase() !== targetTier) {
        return NextResponse.json(
          {
            valid: false,
            error: `This promo code is only valid for the ${coupon.tier_allowed.toUpperCase()} plan.`,
          },
          { status: 400 }
        );
      }
    }

    // Calculate original and discounted prices
    const planConfig = SUBSCRIPTION_PLANS[targetTier as keyof typeof SUBSCRIPTION_PLANS];
    const basePrice = planConfig?.priceINR || 499;
    const originalPrice =
      billingCycle === 'yearly' && basePrice > 0
        ? Math.round(basePrice * 9.6)
        : basePrice;

    const discountMultiplier = Math.max(0, (100 - coupon.discount_percent) / 100);
    const discountedPrice = Math.round(originalPrice * discountMultiplier);
    const savings = originalPrice - discountedPrice;
    const isFree = discountedPrice === 0 || coupon.discount_percent === 100;

    // 3. Return the discount_percent if valid
    return NextResponse.json({
      valid: true,
      discount_percent: coupon.discount_percent,
      code: coupon.code,
      tier_allowed: coupon.tier_allowed,
      original_price: originalPrice,
      discounted_price: discountedPrice,
      savings,
      is_free: isFree,
      message:
        coupon.discount_percent === 100
          ? `Alhamdulillah! 100% discount applied with code ${coupon.code}.`
          : `Promo code applied! ${coupon.discount_percent}% OFF (${coupon.code}).`,
    });
  } catch (error: any) {
    console.error('[Coupons API] Validation error:', error);
    return NextResponse.json(
      { valid: false, error: error?.message || 'Failed to validate coupon code.' },
      { status: 500 }
    );
  }
}
