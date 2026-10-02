// ==============================================================================
// NEXT.JS API ROUTE: RAZORPAY SERVER-TO-SERVER ORDER CREATION
// File: src/app/api/payments/create-order/route.ts
// Endpoint: POST /api/payments/create-order
// ==============================================================================

import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { SUBSCRIPTION_PLANS } from '@/src/lib/dodoPayments';
import { validateCoupon, incrementCouponUsage } from '@/src/lib/coupons';

export const dynamic = 'force-dynamic';

export const TIER_PRICING_PAISE: Record<string, { monthly: number; yearly: number; name: string }> = {
  free: { monthly: 0, yearly: 0, name: 'Free Sunnah Plan' },
  gold: { monthly: 49900, yearly: 479000, name: 'Gold Matrimonial' },
  platinum: { monthly: 99900, yearly: 959000, name: 'Platinum Matrimonial' },
  diamond: { monthly: 99900, yearly: 959000, name: 'Diamond Wali Access' },
};

export interface CreateOrderRequest {
  tier?: string;
  amount?: number;
  interval?: 'monthly' | 'yearly' | string;
  billingCycle?: 'monthly' | 'yearly' | string;
  profileId?: string;
  userId?: string;
  user_id?: string;
  currency?: string;
  couponCode?: string;
  coupon?: string;
}

export interface CreateOrderResponse {
  success?: boolean;
  order_id?: string;
  id?: string;
  amount?: number;
  currency?: string;
  key_id?: string;
  tier?: string;
  interval?: string;
  isFree?: boolean;
  discount_percent?: number;
  error?: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      tier = 'gold',
      interval = 'monthly',
      billingCycle,
      couponCode,
      coupon,
      profileId,
      userId,
    } = body || {};

    const normalizedTier = String(tier).toLowerCase();
    const effectiveInterval = String(billingCycle || interval).toLowerCase() === 'yearly' ? 'yearly' : 'monthly';

    // 1. Calculate canonical server-side base amount to prevent client tampering
    const planConfig = SUBSCRIPTION_PLANS[normalizedTier as keyof typeof SUBSCRIPTION_PLANS];
    const basePriceINR = planConfig?.priceINR ?? (normalizedTier === 'diamond' ? 999 : 499);
    const originalPaise =
      effectiveInterval === 'yearly' && basePriceINR > 0
        ? Math.round(basePriceINR * 9.6 * 100)
        : Math.round(basePriceINR * 100);

    // 2. Validate Coupon and recalculate server-verified discounted amount
    const codeToValidate = (couponCode || coupon || '').trim();
    let discountPercent = 0;
    let validatedCouponCode: string | null = null;

    if (codeToValidate) {
      const couponResult = await validateCoupon(codeToValidate, normalizedTier);
      if (!couponResult.valid || !couponResult.coupon) {
        return NextResponse.json(
          { error: couponResult.error || 'Invalid promo code provided.' },
          { status: 400 }
        );
      }
      discountPercent = couponResult.coupon.discount_percent;
      validatedCouponCode = couponResult.coupon.code;
    }

    // Apply verified discount
    const discountMultiplier = Math.max(0, (100 - discountPercent) / 100);
    const verifiedAmountPaise = Math.round(originalPaise * discountMultiplier);

    // 3. Free Tier or 100% Promo Coupon fulfillment bypass
    if (normalizedTier === 'free' || verifiedAmountPaise === 0 || discountPercent === 100) {
      if (validatedCouponCode) {
        await incrementCouponUsage(validatedCouponCode);
      }
      return NextResponse.json({
        success: true,
        isFree: true,
        tier: normalizedTier,
        order_id: `free_${validatedCouponCode ? 'coupon_' : ''}${Date.now()}`,
        id: `free_${validatedCouponCode ? 'coupon_' : ''}${Date.now()}`,
        amount: 0,
        currency: 'INR',
        discount_percent: discountPercent,
        coupon_applied: validatedCouponCode,
      });
    }

    // 4. Audit Razorpay environment variables for paid checkout orders
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: 'Missing Razorpay API keys in environment variables' },
        { status: 500 }
      );
    }

    // 5. Initialize Razorpay instance
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // 6. Verify payload sent to razorpay.orders.create
    // amount: Must be an integer in paise.
    const orderOptions = {
      amount: verifiedAmountPaise,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        tier: normalizedTier,
        interval: effectiveInterval,
        coupon: validatedCouponCode || '',
        profileId: profileId || userId || '',
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    if (validatedCouponCode) {
      await incrementCouponUsage(validatedCouponCode);
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      tier: normalizedTier,
      interval: effectiveInterval,
      discount_percent: discountPercent,
      coupon_applied: validatedCouponCode,
    });
  } catch (error: any) {
    console.error('Order creation failed:', error);
    const errorMsg =
      error?.error?.description ||
      error?.message ||
      error?.description ||
      'Order creation failed on server';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET() {
  const hasKeys = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  return NextResponse.json({
    status: hasKeys ? 'ok' : 'missing_keys',
    configured: hasKeys,
    keyPrefix: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.slice(0, 8) : null,
  });
}
