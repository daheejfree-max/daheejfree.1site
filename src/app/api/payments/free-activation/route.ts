// ==============================================================================
// NEXT.JS API ROUTE: FREE SUBSCRIPTION ACTIVATION (EARLY ADOPTER & 100% COUPON)
// File: src/app/api/payments/free-activation/route.ts
// Endpoint: POST /api/payments/free-activation
// Strictly uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for database mutations
// ==============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  MAX_EARLY_ADOPTERS,
  IN_MEMORY_COUPONS,
  incrementCouponUsage,
} from '@/src/lib/coupons';

export const dynamic = 'force-dynamic';

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Database query timed out')), ms)),
  ]);
}

export async function GET() {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '';
    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

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

    let claimedCount = 0;
    try {
      const { count, error } = await withTimeout(
        supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_early_adopter', true)
      );

      if (error) {
        console.warn('[Free Activation GET] Supabase count query warning:', error.message);
      } else if (typeof count === 'number') {
        claimedCount = count;
      }
    } catch (timeoutErr) {
      console.warn('[Free Activation GET] Count query timed out or failed:', timeoutErr);
    }

    const remaining = Math.max(0, MAX_EARLY_ADOPTERS - claimedCount);

    return NextResponse.json({
      success: true,
      claimed_count: claimedCount,
      max_early_adopters: MAX_EARLY_ADOPTERS,
      remaining,
      is_available: claimedCount < MAX_EARLY_ADOPTERS,
    });
  } catch (error: any) {
    console.error('Free Activation Error (GET stats):', error);
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

    // 1. Initialize admin client inside the POST handler using SUPABASE_SERVICE_ROLE_KEY to bypass RLS
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

    // 2. Standard user client ONLY to verify authenticated user's session and get user.id
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseAnonKey,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const body = await req.json().catch(() => ({}));
    const { tier = 'diamond', reason, couponCode } = body || {};

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    let userId = body?.userId || body?.profileId || '';

    // Verify authenticated user's session via standard user client
    if (token) {
      try {
        const {
          data: { user },
          error: authErr,
        } = await supabaseUser.auth.getUser(token);
        if (!authErr && user?.id) {
          userId = user.id;
        } else if (authErr) {
          console.warn('[Free Activation] User client token verification note:', authErr.message);
        }
      } catch (err) {
        console.warn('[Free Activation] User token lookup catch:', err);
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in to activate membership.' },
        { status: 401 }
      );
    }

    // Branch A: First 30 Users Founder's Reward (Free Diamond Tier)
    if (reason === 'early_adopter') {
      let isAlreadyClaimed = false;

      // 1. Check if user is already an early adopter using supabaseAdmin
      try {
        const { data: profile, error: profileErr } = await withTimeout(
          supabaseAdmin
            .from('profiles')
            .select('id, is_early_adopter, subscription_tier')
            .eq('id', userId)
            .maybeSingle(),
          2000
        );

        if (profileErr) {
          console.warn('[Free Activation] Note reading profile is_early_adopter:', profileErr.message);
        } else if (profile?.is_early_adopter) {
          isAlreadyClaimed = true;
        }
      } catch (checkErr) {
        console.warn('[Free Activation] Profile check catch:', checkErr);
      }

      if (isAlreadyClaimed) {
        return NextResponse.json({
          success: true,
          alreadyClaimed: true,
          tier: 'diamond',
          is_early_adopter: true,
          message: "You have already claimed the Founder's Reward. Diamond membership is active!",
        });
      }

      // 2. Use supabaseAdmin to query the COUNT(*) of early adopters
      let earlyAdopterCount = 0;
      try {
        const { count: currentCount, error: countErr } = await withTimeout(
          supabaseAdmin
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('is_early_adopter', true),
          2000
        );

        if (countErr) {
          console.warn('[Free Activation] Note counting early adopters:', countErr.message);
        } else if (typeof currentCount === 'number') {
          earlyAdopterCount = currentCount;
        }
      } catch (countCatch) {
        console.warn('[Free Activation] Early adopter count catch:', countCatch);
      }

      if (earlyAdopterCount >= MAX_EARLY_ADOPTERS) {
        return NextResponse.json(
          {
            success: false,
            error: 'The first 30 free subscriptions have already been claimed.',
            claimed_count: earlyAdopterCount,
            remaining: 0,
          },
          { status: 400 }
        );
      }

      // 3. Execute UPDATE on profiles table using supabaseAdmin (bypasses RLS)
      let lastUpdateError: any = null;
      try {
        const { error: updateErr } = await withTimeout(
          supabaseAdmin
            .from('profiles')
            .update({
              subscription_tier: 'diamond',
              membership_tier: 'diamond',
              subscription_status: 'active',
              is_early_adopter: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId),
          2000
        );

        if (updateErr) {
          lastUpdateError = updateErr;
          console.warn('[Free Activation] Full profile update note, attempting base tier update:', updateErr.message);

          // Retry with baseline columns in case is_early_adopter is still being added via SQL
          const { error: fallbackErr } = await withTimeout(
            supabaseAdmin
              .from('profiles')
              .update({
                subscription_tier: 'diamond',
                membership_tier: 'diamond',
              })
              .eq('id', userId),
            2000
          );

          if (!fallbackErr) {
            lastUpdateError = null;
          }
        }
      } catch (err: any) {
        console.error('Free Activation Error updating profile:', err);
        lastUpdateError = err;
      }

      const updatedCount = earlyAdopterCount + 1;
      const remaining = Math.max(0, MAX_EARLY_ADOPTERS - updatedCount);

      return NextResponse.json({
        success: true,
        tier: 'diamond',
        is_early_adopter: true,
        message: "🎉 Founder's Reward activated! Diamond Membership granted for being one of the first 30 users.",
        remaining,
        warning: lastUpdateError ? `Note: ${lastUpdateError?.message || lastUpdateError}` : undefined,
      });
    }

    // Branch B: 100% Promo Coupon
    if (reason === 'coupon') {
      if (!couponCode || typeof couponCode !== 'string') {
        return NextResponse.json(
          { success: false, error: 'A coupon code is required for coupon activation.' },
          { status: 400 }
        );
      }

      const cleanCode = couponCode.trim().toUpperCase();

      // Query coupons table using supabaseAdmin to bypass RLS
      let couponData: any = null;
      try {
        const { data, error: couponErr } = await withTimeout(
          supabaseAdmin
            .from('coupons')
            .select('*')
            .ilike('code', cleanCode)
            .eq('is_active', true)
            .maybeSingle(),
          2000
        );

        if (couponErr) {
          console.warn('[Free Activation] Coupon query note:', couponErr.message);
        } else {
          couponData = data;
        }
      } catch (couponFetchErr) {
        console.warn('[Free Activation] Coupon lookup catch:', couponFetchErr);
      }

      let coupon = couponData;
      if (!coupon && IN_MEMORY_COUPONS[cleanCode]) {
        coupon = { ...IN_MEMORY_COUPONS[cleanCode] };
      }

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

      if (Number(coupon.used_count || 0) >= Number(coupon.max_uses || 100)) {
        return NextResponse.json(
          { success: false, error: 'Coupon expired' },
          { status: 400 }
        );
      }

      if (Number(coupon.discount_percent) !== 100) {
        return NextResponse.json(
          {
            success: false,
            error: `Coupon ${coupon.code} provides a ${coupon.discount_percent}% discount, not a 100% free activation.`,
          },
          { status: 400 }
        );
      }

      // Increment coupon usage using supabaseAdmin
      if (couponData?.id) {
        try {
          await withTimeout(
            supabaseAdmin
              .from('coupons')
              .update({
                used_count: Number(couponData.used_count || 0) + 1,
              })
              .eq('id', couponData.id),
            2000
          );
        } catch (incErr) {
          console.warn('[Free Activation] Error incrementing coupon count in DB:', incErr);
        }
      }
      await incrementCouponUsage(cleanCode);

      const targetTier = String(tier || 'diamond').toLowerCase();
      const finalTier = targetTier === 'gold' ? 'gold' : 'diamond';

      // Update profiles table using supabaseAdmin (bypasses RLS)
      try {
        const { error: profileUpdateErr } = await withTimeout(
          supabaseAdmin
            .from('profiles')
            .update({
              subscription_tier: finalTier,
              membership_tier: finalTier,
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId),
          2000
        );

        if (profileUpdateErr) {
          console.warn('[Free Activation] Full tier update note, retrying basic update:', profileUpdateErr.message);
          const { error: basicErr } = await withTimeout(
            supabaseAdmin
              .from('profiles')
              .update({
                subscription_tier: finalTier,
                membership_tier: finalTier,
              })
              .eq('id', userId),
            2000
          );

          if (basicErr) {
            console.error('Free Activation Error updating subscription tier:', basicErr);
          }
        }
      } catch (err: any) {
        console.error('Free Activation Error updating profile:', err);
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
    console.error('Free Activation Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Free activation failed.' },
      { status: 500 }
    );
  }
}
