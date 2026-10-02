// ==============================================================================
// NEXT.JS API ROUTE: PROMO COUPON VALIDATION
// File: src/app/api/coupons/validate/route.ts
// Endpoint: POST /api/coupons/validate
// Strictly uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for reading coupons table
// ==============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { IN_MEMORY_COUPONS } from '@/src/lib/coupons';
import { SUBSCRIPTION_PLANS } from '@/src/lib/dodoPayments';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '';
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      '';
    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      supabaseAnonKey;

    // Initialize admin client inside the POST handler using SUPABASE_SERVICE_ROLE_KEY to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body = await req.json().catch(() => ({}));
    const { code, tier = 'diamond', billingCycle = 'monthly' } = body || {};

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { valid: false, error: 'Please enter a promo code.' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    // Query coupons table using supabaseAdmin (bypassing RLS)
    const { data: dbCoupon, error: queryError } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .ilike('code', cleanCode)
      .eq('is_active', true)
      .maybeSingle();

    if (queryError) {
      console.error('Coupon Validation Error (querying coupons):', queryError);
      // If table missing or query failed and no in-memory fallback exists, return 500 with exact error
      if (!IN_MEMORY_COUPONS[cleanCode]) {
        return NextResponse.json(
          { valid: false, error: `Database error querying coupons: ${queryError.message}` },
          { status: 500 }
        );
      }
    }

    let coupon = dbCoupon;
    if (!coupon && IN_MEMORY_COUPONS[cleanCode]) {
      coupon = { ...IN_MEMORY_COUPONS[cleanCode] };
    }

    if (!coupon) {
      return NextResponse.json(
        { valid: false, error: 'Invalid promo code.' },
        { status: 400 }
      );
    }

    // Check usage count
    if (Number(coupon.used_count || 0) >= Number(coupon.max_uses || 100)) {
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
      if (coupon.tier_allowed && coupon.tier_allowed !== 'all' && coupon.tier_allowed.toLowerCase() !== targetTier) {
        return NextResponse.json(
          {
            valid: false,
            error: `This promo code is only valid for the ${coupon.tier_allowed.toUpperCase()} plan.`,
          },
          { status: 400 }
        );
      }
    }

    const discountPercent = Number(coupon.discount_percent);
    const planConfig = SUBSCRIPTION_PLANS[targetTier as keyof typeof SUBSCRIPTION_PLANS];
    const basePrice = planConfig?.priceINR || 499;
    const originalPrice =
      billingCycle === 'yearly' && basePrice > 0
        ? Math.round(basePrice * 9.6)
        : basePrice;

    const discountMultiplier = Math.max(0, (100 - discountPercent) / 100);
    const discountedPrice = Math.round(originalPrice * discountMultiplier);
    const savings = originalPrice - discountedPrice;
    const isFree = discountedPrice === 0 || discountPercent === 100;

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      discount_percent: discountPercent,
      tier_allowed: coupon.tier_allowed || 'all',
      original_price: originalPrice,
      discounted_price: discountedPrice,
      savings,
      is_free: isFree,
      message:
        discountPercent === 100
          ? `Alhamdulillah! 100% discount applied with code ${coupon.code}.`
          : `Promo code applied! ${discountPercent}% OFF (${coupon.code}).`,
    });
  } catch (error: any) {
    console.error('Coupon Validation Error:', error);
    return NextResponse.json(
      { valid: false, error: error?.message || 'Failed to validate coupon code.' },
      { status: 500 }
    );
  }
}
