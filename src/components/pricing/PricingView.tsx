'use client';

// ==============================================================================
// 3-TIER PRICING VIEW WITH RAZORPAY / DODO & PROMO COUPONS
// Strictly 3 Tiers: Free (Upgraded), Gold, and Diamond
// Includes Promo / Discount Coupon System & First 30 Users Free Auto-Claim
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  Crown,
  Check,
  Shield,
  Sparkles,
  Zap,
  Lock,
  CreditCard,
  Video,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  Tag,
  Gift,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SubscriptionTier, BillingCycle, Profile } from '../../types';
import { SUBSCRIPTION_PLANS, initiateDodoCheckout } from '../../lib/dodoPayments';
import { initiateRazorpayCheckout } from '../../lib/razorpay';
import { daheejStore } from '../../lib/supabase/store';
import { supabase } from '../../lib/supabase/client';

interface PricingViewProps {
  currentTier: SubscriptionTier;
  currentProfile: Profile | null;
  onSubscriptionUpdated: () => void;
  onNavigateRegister?: () => void;
}

export const PricingView: React.FC<PricingViewProps> = ({
  currentTier,
  currentProfile,
  onSubscriptionUpdated,
  onNavigateRegister,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [paymentGateway, setPaymentGateway] = useState<'razorpay' | 'dodo'>('razorpay');
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Promo Coupon State
  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_percent: number;
    tier_allowed: string;
    message: string;
  } | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState<boolean>(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Early Adopter Status State
  const [earlyAccessInfo, setEarlyAccessInfo] = useState<{
    claimed_count: number;
    max_early_adopters: number;
    remaining: number;
    is_available: boolean;
  } | null>(null);
  const [isClaimingEarlyAccess, setIsClaimingEarlyAccess] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/payments/claim-early-access')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data?.success) {
          setEarlyAccessInfo(data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter to strict 3 tiers
  const visibleTiers: SubscriptionTier[] = ['free', 'gold', 'diamond'];

  // Canonical Tier Hierarchy (Level 0: free, Level 1: gold, Level 2: diamond)
  const TIER_LEVELS: Record<string, number> = {
    free: 0,
    gold: 1,
    platinum: 2,
    diamond: 2,
  };

  const userTier = (currentProfile?.subscription_tier || currentTier || 'free').toLowerCase();
  const userLevel = TIER_LEVELS[userTier] ?? 0;
  const isEarlyAdopter = Boolean(currentProfile?.is_early_adopter);
  const isEarlyAdopterEligible =
    !isEarlyAdopter &&
    userLevel === 0 &&
    ((earlyAccessInfo?.claimed_count ?? 0) < 30 || (earlyAccessInfo?.remaining ?? 0) > 0);

  // Early Supporter Auto-Claim Handler (Free Diamond Membership)
  const handleClaimEarlyAccess = async () => {
    if (!currentProfile) {
      if (onNavigateRegister) onNavigateRegister();
      return;
    }

    setIsClaimingEarlyAccess(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let authToken = '';
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        authToken = sessionData.session?.access_token || '';
      } catch {}

      const res = await fetch('/api/payments/free-activation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          tier: 'diamond',
          reason: 'early_adopter',
          userId: currentProfile.id,
          profileId: currentProfile.id,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setErrorMessage(data?.error || 'Unable to claim early supporter perk.');
        setIsClaimingEarlyAccess(false);
        return;
      }

      daheejStore.updateProfile(currentProfile.id, {
        subscription_tier: 'diamond',
        membership_tier: 'diamond',
        is_early_adopter: true,
      });

      try {
        await supabase
          .from('profiles')
          .update({
            subscription_tier: 'diamond',
            subscription_status: 'active',
            is_early_adopter: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentProfile.id);
      } catch (dbErr) {
        console.warn('[EarlyAccess] Profile update note:', dbErr);
      }

      onSubscriptionUpdated();
      setSuccessMessage(data.message || "🎉 Founder's Reward activated! Diamond Membership granted.");

      try {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.5 },
        });
      } catch (e) {}
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to claim early supporter perk.');
    } finally {
      setIsClaimingEarlyAccess(false);
    }
  };

  // Promo Coupon Validation Handler
  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = couponCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setCouponError('Please enter a promo code.');
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError(null);

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          tier: 'gold',
          billingCycle,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.valid) {
        setCouponError(data?.error || 'Invalid or expired promo code.');
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon({
        code: data.code,
        discount_percent: data.discount_percent,
        tier_allowed: data.tier_allowed,
        message: data.message,
      });
      setCouponError(null);
      setSuccessMessage(data.message);
    } catch (err: any) {
      setCouponError(err?.message || 'Error validating promo code.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setCouponError(null);
  };

  const handleUpgrade = async (tierName: SubscriptionTier) => {
    if (!currentProfile) {
      if (onNavigateRegister) {
        onNavigateRegister();
      }
      return;
    }

    const planLevel = TIER_LEVELS[tierName] ?? 0;

    // Block plan degradation
    if (planLevel < userLevel) {
      setErrorMessage('Plan downgrade is not permitted. Your current plan includes all these features.');
      return;
    }

    if (planLevel === userLevel) {
      return;
    }

    // For Free Sunnah card, completely prevent opening a checkout session
    if (tierName === 'free') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'profile' }));
      }
      return;
    }

    setLoadingTier(tierName);
    setSuccessMessage(null);
    setErrorMessage(null);

    // Check if coupon gives 100% discount or user qualifies for Founder's Free Diamond
    const isCouponApplicable =
      appliedCoupon &&
      (appliedCoupon.tier_allowed === 'all' ||
        appliedCoupon.tier_allowed.toLowerCase() === tierName.toLowerCase());

    const is100PercentOff = isCouponApplicable && appliedCoupon?.discount_percent === 100;
    const isEarlyDiamondClaim = isEarlyAdopterEligible && tierName === 'diamond';
    const isFreeActivation = is100PercentOff || isEarlyDiamondClaim;

    // Razorpay Bypass: If final calculated price is ₹0 (first 30 users or 100% coupon)
    if (isFreeActivation) {
      try {
        let authToken = '';
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          authToken = sessionData.session?.access_token || '';
        } catch {}

        const freeRes = await fetch('/api/payments/free-activation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            tier: tierName,
            reason: isEarlyDiamondClaim ? 'early_adopter' : 'coupon',
            couponCode: appliedCoupon?.code,
            userId: currentProfile.id,
            profileId: currentProfile.id,
          }),
        });

        const freeData = await freeRes.json().catch(() => ({}));
        if (!freeRes.ok || !freeData.success) {
          setErrorMessage(freeData?.error || 'Failed to claim free subscription.');
          setLoadingTier(null);
          return;
        }

        daheejStore.updateProfile(currentProfile.id, {
          subscription_tier: tierName,
          membership_tier: tierName,
          is_early_adopter: isEarlyDiamondClaim || Boolean(freeData.is_early_adopter),
        });

        try {
          await supabase
            .from('profiles')
            .update({
              subscription_tier: tierName,
              subscription_status: 'active',
              is_early_adopter: isEarlyDiamondClaim || Boolean(freeData.is_early_adopter),
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentProfile.id);
        } catch (dbErr) {
          console.warn('[PricingView] DB update note:', dbErr);
        }

        onSubscriptionUpdated();
        setSuccessMessage(
          freeData.message ||
            `Alhamdulillah! Free activation successful: ${SUBSCRIPTION_PLANS[tierName].name}${
              appliedCoupon ? ` (Promo ${appliedCoupon.code} applied)` : ''
            }.`
        );

        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.5 },
          });
        } catch (e) {}

        setLoadingTier(null);
        return;
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to claim subscription.');
        setLoadingTier(null);
        return;
      }
    }

    // Razorpay Flow (Server-to-Server order creation with coupon code & client modal trigger)
    if (paymentGateway === 'razorpay') {
      const res = await initiateRazorpayCheckout({
        tier: tierName,
        billingCycle,
        profileId: currentProfile.id,
        userEmail: currentProfile.wali_email || undefined,
        userName: currentProfile.full_name,
        couponCode: isCouponApplicable ? appliedCoupon?.code : undefined,
        onSuccess: () => {
          onSubscriptionUpdated();
          setSuccessMessage(`Alhamdulillah! Subscription upgraded to ${SUBSCRIPTION_PLANS[tierName].name}.`);
          try {
            confetti({
              particleCount: 100,
              spread: 80,
              origin: { y: 0.5 },
            });
          } catch (e) {
            // ignore
          }
        },
        onFailure: (err) => {
          setErrorMessage(err);
        },
      });

      setLoadingTier(null);
      return;
    }

    // Fallback or explicit Dodo Flow
    const res = await initiateDodoCheckout({
      tier: tierName,
      billingCycle,
      profileId: currentProfile.id,
      customerEmail: currentProfile.wali_email || undefined,
      customerName: currentProfile.full_name,
    });

    setLoadingTier(null);

    if (res.success) {
      if (!res.checkoutUrl) {
        onSubscriptionUpdated();
        setSuccessMessage(`Alhamdulillah! Subscription upgraded to ${SUBSCRIPTION_PLANS[tierName].name}.`);
        try {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.5 },
          });
        } catch (e) {
          // ignore
        }
      }
    } else {
      setErrorMessage(res.error || 'Failed to initiate checkout.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-6 px-4">
      {/* Top Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 shadow-sm">
          <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Production Shariah-Compliant Matrimonial Plans
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          Invest in a Dignified, Dowry-Free Nikah
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          Choose a transparent membership tier to unlock verified communication, 2-way unblurred photo permissions, and WebRTC video calling.
        </p>

        {/* Error Alert */}
        {errorMessage && (
          <div className="max-w-md mx-auto p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="max-w-md mx-auto p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Founder's Reward Banner: First 30 Users Free Diamond */}
      {!isEarlyAdopter && userLevel === 0 && ((earlyAccessInfo?.claimed_count ?? 0) < 30) && (
        <div className="max-w-4xl mx-auto p-5 rounded-3xl bg-gradient-to-r from-emerald-950/90 via-zinc-900 to-teal-950/90 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 flex items-center justify-center font-extrabold shadow-md shrink-0">
              <Gift className="w-6 h-6 text-zinc-950" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                🎉 Founder's Reward: Free Diamond Membership for the first 30 users!
              </h4>
              <p className="text-xs text-zinc-300 mt-1">
                {Math.max(0, 30 - (earlyAccessInfo?.claimed_count || 0))} of 30 spots remaining. Activate full Diamond tier to connect directly with Wali guardians.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClaimEarlyAccess}
            disabled={isClaimingEarlyAccess}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-white text-xs font-bold shadow-md cursor-pointer shrink-0 transition-all flex items-center gap-1.5"
          >
            {isClaimingEarlyAccess ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Crown className="w-4 h-4" />
                <span>Claim Free Diamond</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Billing Cycle Toggle & Gateway Selector */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl flex items-center gap-1 shadow-sm">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              billingCycle === 'yearly'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Annual Billing
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800 font-bold">
              20% OFF
            </span>
          </button>
        </div>

        {/* Gateway Selector */}
        <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl flex items-center gap-1 shadow-sm">
          <button
            onClick={() => setPaymentGateway('razorpay')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              paymentGateway === 'razorpay'
                ? 'bg-emerald-700 text-white shadow-md'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-white/90" />
            <span>Razorpay (UPI / Cards)</span>
          </button>
          <button
            onClick={() => setPaymentGateway('dodo')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              paymentGateway === 'dodo'
                ? 'bg-emerald-700 text-white shadow-md'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <span>Global (Dodo)</span>
          </button>
        </div>
      </div>

      {/* 3 Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {visibleTiers.map((t) => {
          const plan = SUBSCRIPTION_PLANS[t];
          const planLevel = TIER_LEVELS[t] ?? 0;
          const isCurrent = Boolean(currentProfile) && planLevel === userLevel;
          const isIncluded = Boolean(currentProfile) && planLevel < userLevel;
          const isDiamond = t === 'diamond';
          const isGold = t === 'gold';
          const isLoading = loadingTier === t;

          const basePrice =
            billingCycle === 'yearly' && plan.priceINR > 0
              ? Math.round(plan.priceINR * 9.6)
              : plan.priceINR;

          // Check if coupon applies to this tier
          const isCouponApplicable =
            appliedCoupon &&
            (appliedCoupon.tier_allowed === 'all' ||
              appliedCoupon.tier_allowed.toLowerCase() === t.toLowerCase());

          const discountPercent = isCouponApplicable ? appliedCoupon.discount_percent : 0;
          const isEarlyDiamondFree =
            !isEarlyAdopter &&
            userLevel === 0 &&
            ((earlyAccessInfo?.claimed_count ?? 0) < 30) &&
            isDiamond;

          let finalPrice = Math.max(0, Math.round(basePrice * (1 - discountPercent / 100)));
          if (isEarlyDiamondFree) {
            finalPrice = 0;
          }

          const hasDiscount = discountPercent > 0 || isEarlyDiamondFree;
          const isFullyDiscounted = hasDiscount && finalPrice === 0;

          const isButtonDisabled = isCurrent || isIncluded || isLoading;

          return (
            <div
              key={t}
              className={`rounded-3xl p-7 flex flex-col justify-between transition-all relative ${
                isDiamond
                  ? 'bg-gradient-to-b from-emerald-50 via-white to-white dark:from-emerald-950/60 dark:via-zinc-900 dark:to-zinc-950 border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 dark:shadow-emerald-950/60 ring-4 ring-emerald-500/10'
                  : isGold
                  ? 'bg-gradient-to-b from-amber-50/50 via-white to-white dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-950 border border-amber-300 dark:border-amber-700/60 shadow-md'
                  : 'bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
              }`}
            >
              {isDiamond && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-extrabold uppercase tracking-wider py-1 px-4 rounded-full shadow-md flex items-center gap-1">
                  <Crown className="w-3 h-3 fill-amber-300 text-amber-300" />
                  {isEarlyDiamondFree ? "Founder's Free Diamond" : "Most Complete Matrimonial Plan"}
                </div>
              )}

              {isGold && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider py-0.5 px-3 rounded-full shadow-sm">
                  Popular Choice
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {t === 'free'
                        ? 'For candidates starting their search'
                        : t === 'gold'
                        ? 'For active matrimonial candidates'
                        : 'Complete guardian & call features'}
                    </p>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      isDiamond
                        ? 'bg-emerald-600 text-white shadow-md'
                        : isGold
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {isDiamond ? (
                      <Crown className="w-5 h-5" />
                    ) : isGold ? (
                      <Sparkles className="w-5 h-5" />
                    ) : (
                      <Shield className="w-5 h-5" />
                    )}
                  </div>
                </div>

                {/* Price Display */}
                <div className="my-5 pb-5 border-b border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-baseline gap-2">
                    {hasDiscount && basePrice > 0 && (
                      <span className="text-sm font-semibold line-through text-zinc-500">
                        ₹{basePrice.toLocaleString()}
                      </span>
                    )}
                    <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">
                      {finalPrice === 0 ? 'Free' : `₹${finalPrice.toLocaleString()}`}
                    </span>
                    {hasDiscount && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        {isEarlyDiamondFree ? "Founder's Reward" : `${discountPercent}% OFF`}
                      </span>
                    )}
                    {finalPrice > 0 && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        /{billingCycle === 'yearly' ? 'year' : 'month'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {t === 'free'
                      ? 'No credit card required. Sunnah-first matching.'
                      : hasDiscount
                      ? `Promo code ${appliedCoupon?.code} applied.`
                      : billingCycle === 'yearly'
                      ? 'Billed annually. Includes 20% discount.'
                      : 'Billed monthly. Cancel anytime.'}
                  </p>
                </div>

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleUpgrade(t)}
                disabled={isButtonDisabled}
                className={`w-full py-3.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isButtonDisabled
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-700'
                    : isFullyDiscounted
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30 active:scale-98 cursor-pointer ring-2 ring-emerald-400/50'
                    : isDiamond
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 active:scale-98 cursor-pointer'
                    : isGold
                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-900/10 active:scale-98 cursor-pointer'
                    : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm active:scale-98 cursor-pointer'
                }`}
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isCurrent ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>Current Active Plan</span>
                  </>
                ) : isIncluded ? (
                  <>
                    <Lock className="w-4 h-4 text-zinc-400" />
                    <span>Included in Your Plan</span>
                  </>
                ) : isEarlyDiamondFree ? (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>Claim Free Diamond</span>
                  </>
                ) : isFullyDiscounted ? (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>Claim Free Subscription</span>
                  </>
                ) : (
                  <>
                    <span>Upgrade to {plan.name}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Promo / Discount Coupon Section (Positioned Below Pricing Cards) */}
      <div className="max-w-4xl mx-auto p-4 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Have a promo code?
              </span>
              {appliedCoupon && (
                <span className="ml-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                  {appliedCoupon.code} Active ({appliedCoupon.discount_percent}% OFF)
                </span>
              )}
            </div>
          </div>

          {appliedCoupon ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {appliedCoupon.discount_percent}% discount applied
              </span>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-xs text-zinc-400 hover:text-rose-500 underline cursor-pointer ml-1"
              >
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleApplyCoupon} className="flex items-center gap-2">
              <input
                type="text"
                value={couponCodeInput}
                onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                placeholder="Have a promo code?"
                className="w-40 sm:w-48 px-3.5 py-1.5 text-xs font-mono font-bold tracking-wider rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isValidatingCoupon || !couponCodeInput.trim()}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                {isValidatingCoupon ? 'Validating...' : 'Apply'}
              </button>
            </form>
          )}
        </div>

        {couponError && (
          <p className="text-[11px] text-rose-500 mt-2 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {couponError}
          </p>
        )}

        {!appliedCoupon && !couponError && (
          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span>Available codes:</span>
            <button
              type="button"
              onClick={() => setCouponCodeInput('SUNNAH100')}
              className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              SUNNAH100 (100% OFF)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setCouponCodeInput('BARAKAH50')}
              className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              BARAKAH50 (50% OFF)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setCouponCodeInput('DAHEEJFREE20')}
              className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              DAHEEJFREE20 (20% OFF)
            </button>
          </div>
        )}
      </div>

      {/* Bottom Guarantee Banner */}
      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-3xl p-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
          <Shield className="w-4 h-4" />
          <span>The DaheejFree Zero-Dowry Guarantee</span>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          Every subscription supports our legal advocacy and non-profit anti-dowry movement. If any verified match on DaheejFree demands dowry, report them immediately for prompt banning.
        </p>
      </div>
    </div>
  );
};
