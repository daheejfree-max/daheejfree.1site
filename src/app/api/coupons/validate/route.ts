// ==============================================================================
// NEXT.JS API ROUTE: PROMO COUPON VALIDATION
// File: src/app/api/coupons/validate/route.ts
// Endpoint: POST /api/coupons/validate
// ==============================================================================

import { NextResponse } from 'next/server';
import { validateCoupon } from '@/src/lib/coupons';
import { SUBSCRIPTION_PLANS } from '@/src/lib/dodoPayments';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, tier = 'gold', billingCycle = 'monthly' } = body || {};

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Please enter a promo code.' },
        { status: 400 }
      );
    }

    const targetTier = String(tier).toLowerCase();
    const result = await validateCoupon(code, targetTier);

    if (!result.valid || !result.coupon) {
      return NextResponse.json(
        { valid: false, error: result.error || 'Invalid promo code.' },
        { status: 400 }
      );
    }

    const coupon = result.coupon;

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

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      discount_percent: coupon.discount_percent,
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
