// ==============================================================================
// DAHEEJFREE: PROMO COUPONS & FIRST 30 USERS EARLY ADOPTER LOGIC
// File: src/lib/coupons.ts
// ==============================================================================

import { Coupon } from '../types/database';
import { createAdminClient } from './supabase/server';

export const MAX_EARLY_ADOPTERS = 30;

// In-Memory Fallback Coupons (Ensures promo functionality works even if DB table is unmigrated)
export const IN_MEMORY_COUPONS: Record<string, Coupon> = {
  SUNNAH100: {
    code: 'SUNNAH100',
    discount_percent: 100,
    max_uses: 100,
    used_count: 0,
    tier_allowed: 'all',
    is_active: true,
  },
  EARLYBIRD: {
    code: 'EARLYBIRD',
    discount_percent: 100,
    max_uses: 50,
    used_count: 0,
    tier_allowed: 'all',
    is_active: true,
  },
  NIKAH100: {
    code: 'NIKAH100',
    discount_percent: 100,
    max_uses: 30,
    used_count: 0,
    tier_allowed: 'gold',
    is_active: true,
  },
  BARAKAH50: {
    code: 'BARAKAH50',
    discount_percent: 50,
    max_uses: 200,
    used_count: 0,
    tier_allowed: 'all',
    is_active: true,
  },
  DAHEEJFREE20: {
    code: 'DAHEEJFREE20',
    discount_percent: 20,
    max_uses: 500,
    used_count: 0,
    tier_allowed: 'all',
    is_active: true,
  },
};

// In-memory early adopters set for offline/fallback mode
const inMemoryEarlyAdopters = new Set<string>();

/**
 * Retrieve coupon definition from Supabase or in-memory fallback
 */
export async function getCoupon(rawCode: string): Promise<Coupon | null> {
  if (!rawCode || typeof rawCode !== 'string') return null;
  const normalized = rawCode.trim().toUpperCase();

  // 1. Fast path: check known memory coupons immediately
  if (IN_MEMORY_COUPONS[normalized]) {
    const memoryCoupon = { ...IN_MEMORY_COUPONS[normalized] };
    // Asynchronously sync usage count from DB if available
    try {
      const admin = createAdminClient();
      (async () => {
        try {
          const { data } = await admin
            .from('coupons')
            .select('*')
            .ilike('code', normalized)
            .eq('is_active', true)
            .maybeSingle();
          if (data) {
            IN_MEMORY_COUPONS[normalized].used_count = Number(data.used_count || 0);
          }
        } catch {}
      })();
    } catch {}
    return memoryCoupon;
  }

  // 2. Query Supabase for custom database-created coupons with timeout
  try {
    const admin = createAdminClient();
    const queryPromise = admin
      .from('coupons')
      .select('*')
      .ilike('code', normalized)
      .eq('is_active', true)
      .maybeSingle();

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('DB timeout') }), 1200)
    );

    const { data } = await Promise.race([queryPromise, timeoutPromise]);

    if (data) {
      return {
        id: data.id,
        code: data.code.toUpperCase(),
        discount_percent: Number(data.discount_percent),
        max_uses: Number(data.max_uses),
        used_count: Number(data.used_count || 0),
        tier_allowed: data.tier_allowed || 'all',
        is_active: data.is_active,
        expires_at: data.expires_at,
        created_at: data.created_at,
      };
    }
  } catch (err) {
    console.warn('[Coupons] Database lookup fallback to memory:', err);
  }

  return null;
}

/**
 * Validate coupon against current plan tier
 */
export async function validateCoupon(
  rawCode: string,
  targetTier: string
): Promise<{
  valid: boolean;
  coupon?: Coupon;
  error?: string;
}> {
  const coupon = await getCoupon(rawCode);

  if (!coupon) {
    return { valid: false, error: 'Invalid or inactive promo code.' };
  }

  if (coupon.is_active === false) {
    return { valid: false, error: 'This promo code has been deactivated.' };
  }

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { valid: false, error: 'This promo code has expired.' };
  }

  if (coupon.used_count >= coupon.max_uses) {
    return { valid: false, error: 'This promo code has reached its maximum usage limit.' };
  }

  const normalizedTier = targetTier.toLowerCase();
  if (coupon.tier_allowed !== 'all' && coupon.tier_allowed.toLowerCase() !== normalizedTier) {
    return {
      valid: false,
      error: `This promo code is only valid for the ${coupon.tier_allowed.toUpperCase()} plan.`,
    };
  }

  return { valid: true, coupon };
}

/**
 * Increment coupon usage counter in database and memory
 */
export async function incrementCouponUsage(rawCode: string): Promise<void> {
  const normalized = rawCode.trim().toUpperCase();

  // Update in-memory fallback immediately
  if (IN_MEMORY_COUPONS[normalized]) {
    IN_MEMORY_COUPONS[normalized].used_count += 1;
  }

  // Asynchronously update DB in background
  (async () => {
    try {
      const admin = createAdminClient();
      const { data: existing } = await admin
        .from('coupons')
        .select('used_count')
        .ilike('code', normalized)
        .maybeSingle();

      if (existing) {
        await admin
          .from('coupons')
          .update({
            used_count: (existing.used_count || 0) + 1,
          })
          .ilike('code', normalized);
      }
    } catch (err) {
      console.warn('[Coupons] Could not increment coupon used_count in DB:', err);
    }
  })();
}

/**
 * Count total number of profiles marked as is_early_adopter
 */
export async function getEarlyAdopterCount(): Promise<number> {
  try {
    const admin = createAdminClient();
    const countPromise = admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_early_adopter', true);

    const timeoutPromise = new Promise<{ count: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ count: null, error: new Error('DB timeout') }), 1200)
    );

    const { count, error } = await Promise.race([countPromise, timeoutPromise]);

    if (!error && typeof count === 'number') {
      return Math.max(count, inMemoryEarlyAdopters.size);
    }
  } catch (err) {
    console.warn('[EarlyAdopter] Count query fallback:', err);
  }

  return inMemoryEarlyAdopters.size;
}

/**
 * Claim "First 30 Users Free" Gold tier perk
 */
export async function claimEarlyAccess(userId: string): Promise<{
  success: boolean;
  alreadyClaimed?: boolean;
  message?: string;
  remaining?: number;
  error?: string;
}> {
  if (!userId) {
    return { success: false, error: 'Authentication required to claim early adopter perk.' };
  }

  // 1. Check in-memory first
  if (inMemoryEarlyAdopters.has(userId)) {
    const currentCount = await getEarlyAdopterCount();
    return {
      success: true,
      alreadyClaimed: true,
      message: 'You have already claimed your early supporter perk. Gold tier is active.',
      remaining: Math.max(0, MAX_EARLY_ADOPTERS - currentCount),
    };
  }

  try {
    const admin = createAdminClient();

    // Check DB if user already claimed (with 1.2s timeout)
    const checkPromise = admin
      .from('profiles')
      .select('id, is_early_adopter, subscription_tier')
      .eq('id', userId)
      .maybeSingle();

    const timeoutCheck = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('DB timeout') }), 1200)
    );

    const { data: profile } = await Promise.race([checkPromise, timeoutCheck]);

    if (profile?.is_early_adopter) {
      inMemoryEarlyAdopters.add(userId);
      const currentCount = await getEarlyAdopterCount();
      return {
        success: true,
        alreadyClaimed: true,
        message: 'You have already claimed your early supporter perk. Gold tier is active.',
        remaining: Math.max(0, MAX_EARLY_ADOPTERS - currentCount),
      };
    }

    // 2. Count current claims
    const currentCount = await getEarlyAdopterCount();

    if (currentCount >= MAX_EARLY_ADOPTERS) {
      return {
        success: false,
        error: 'The first 30 free subscriptions have already been claimed.',
        remaining: 0,
      };
    }

    // 3. Activate Gold Tier & Mark Early Adopter
    inMemoryEarlyAdopters.add(userId);

    // Asynchronously update DB
    (async () => {
      try {
        const { error: updateErr } = await admin
          .from('profiles')
          .update({
            subscription_tier: 'gold',
            membership_tier: 'gold',
            subscription_status: 'active',
            is_early_adopter: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        if (updateErr) {
          console.warn('[EarlyAdopter] DB Update note:', updateErr);
        }
      } catch (e) {
        console.warn('[EarlyAdopter] DB Update exception:', e);
      }
    })();

    const newCount = await getEarlyAdopterCount();
    const remaining = Math.max(0, MAX_EARLY_ADOPTERS - newCount);

    return {
      success: true,
      message: 'Welcome early supporter! Gold tier activated 100% free.',
      remaining,
    };
  } catch (err: any) {
    console.error('[EarlyAdopter] Claim execution error:', err);
    inMemoryEarlyAdopters.add(userId);
    return {
      success: true,
      message: 'Welcome early supporter! Gold tier activated.',
      remaining: Math.max(0, MAX_EARLY_ADOPTERS - inMemoryEarlyAdopters.size),
    };
  }
}
