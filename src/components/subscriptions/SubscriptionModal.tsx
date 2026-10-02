'use client';

// ==============================================================================
// 3-TIER SUBSCRIPTION MODAL (DAHEEJFREE MATRIMONIAL PLATFORM)
// Strictly 3 Tiers: Free (Sunnah Base), Gold, and Diamond
// Includes Promo / Discount Coupon System & First 30 Users Free Auto-Claim
// Strictly Prevents Plan Degradation & Uses /api/payments/create-order Endpoint
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  Crown,
  Check,
  Shield,
  Sparkles,
  X,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Lock,
  Tag,
  Gift,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SubscriptionTier, BillingCycle, Profile } from '../../types';
import { SUBSCRIPTION_PLANS } from '../../lib/dodoPayments';
import { loadRazorpayScript } from '../../lib/razorpay';
import { daheejStore } from '../../lib/supabase/store';
import { supabase } from '../../lib/supabase/client';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
  currentProfile: Profile | null;
  onSubscriptionUpdated: () => void;
  onNavigate?: (tab: string) => void;
}

// Canonical Tier Hierarchy (Level 0: free, Level 1: gold, Level 2: diamond)
export const TIER_LEVELS: Record<string, number> = {
  free: 0,
  gold: 1,
  platinum: 2, // Alias for diamond tier
  diamond: 2,
};

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  currentProfile,
  onSubscriptionUpdated,
  onNavigate,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
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

  // Query early access spots when modal opens
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  if (!isOpen) return null;

  const visibleTiers: SubscriptionTier[] = ['free', 'gold', 'diamond'];

  // Canonical Tier Hierarchy (Level 0: free, Level 1: gold, Level 2: diamond)
  const userTier = (currentProfile?.subscription_tier || currentTier || 'free').toLowerCase();
  const userLevel = TIER_LEVELS[userTier] ?? 0;
  const isEarlyAdopter = Boolean(currentProfile?.is_early_adopter);
  const isEarlyAdopterEligible =
    !isEarlyAdopter &&
    userLevel === 0 &&
    ((earlyAccessInfo?.claimed_count ?? 0) < 30 || (earlyAccessInfo?.remaining ?? 0) > 0);

  // Early Supporter Auto-Claim Handler (Grants Free Diamond Membership)
  const handleClaimEarlyAccess = async () => {
    if (!currentProfile) {
      setErrorMessage('Please sign in or complete your profile first.');
      return;
    }
    setIsClaimingEarlyAccess(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Optimistically upgrade profile in local reactive store
    daheejStore.updateProfile(currentProfile.id, {
      subscription_tier: 'diamond',
      membership_tier: 'diamond',
      is_early_adopter: true,
    });

    try {
      let authToken = '';
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        authToken = sessionData.session?.access_token || '';
      } catch {}

      // 2. Call backend free-activation API
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

      // 3. Sync to Supabase directly as well
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
        console.warn('[EarlyAccess] Direct Supabase update note:', dbErr);
      }

      onSubscriptionUpdated();
      setSuccessMessage(
        data?.message || "🎉 Founder's Reward activated! Diamond Membership granted for being one of the first 30 users."
      );

      try {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.5 },
        });
      } catch (e) {}

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.warn('[EarlyAccess] API call note:', err);
      onSubscriptionUpdated();
      setSuccessMessage("🎉 Founder's Reward activated! Diamond Membership granted for being one of the first 30 users.");
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
        });
      } catch {}
      setTimeout(() => {
        onClose();
      }, 1800);
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
          tier: 'diamond',
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

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (!currentProfile) return;

    setSuccessMessage(null);
    setErrorMessage(null);

    const planLevel = TIER_LEVELS[tier] ?? 0;

    // Block plan degradation / downgrades
    if (planLevel < userLevel) {
      setErrorMessage('Plan downgrade is not permitted. Your current plan includes all these features.');
      return;
    }

    if (planLevel === userLevel) {
      return; // Already on current plan
    }

    // For the "Free Sunnah" card, completely prevent opening a checkout session;
    // free accounts should only redirect to profile completion.
    if (tier === 'free') {
      onClose();
      if (onNavigate) {
        onNavigate('profile');
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'profile' }));
        window.location.hash = '#profile';
      }
      return;
    }

    setLoadingTier(tier);

    try {
      // Calculate exact plan pricing with coupon applied
      const planConfig = SUBSCRIPTION_PLANS[tier];
      const basePriceINR =
        billingCycle === 'yearly' && planConfig?.priceINR > 0
          ? Math.round(planConfig.priceINR * 9.6)
          : (planConfig?.priceINR || 0);

      const isCouponValidForTier =
        appliedCoupon &&
        (appliedCoupon.tier_allowed === 'all' ||
          appliedCoupon.tier_allowed.toLowerCase() === tier.toLowerCase());

      const discountPercent = isCouponValidForTier ? appliedCoupon.discount_percent : 0;
      let discountedPriceINR = Math.max(0, Math.round(basePriceINR * (1 - discountPercent / 100)));

      // Check if this tier qualifies for the 100% Free Founder's Reward (first 30 users)
      const isEarlyDiamondClaim = isEarlyAdopterEligible && tier === 'diamond';
      if (isEarlyDiamondClaim) {
        discountedPriceINR = 0;
      }

      // =========================================================================
      // RAZORPAY BYPASS:
      // If final calculated price is ₹0 (first 30 users or 100% coupon),
      // bypass Razorpay completely, call /api/payments/free-activation, show toast
      // =========================================================================
      if (discountedPriceINR === 0 || discountPercent === 100) {
        let authToken = '';
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          authToken = sessionData.session?.access_token || '';
        } catch {}

        const activationReason = isEarlyDiamondClaim ? 'early_adopter' : 'coupon';

        const freeRes = await fetch('/api/payments/free-activation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            tier,
            reason: activationReason,
            couponCode: appliedCoupon?.code,
            userId: currentProfile.id,
            profileId: currentProfile.id,
          }),
        });

        const freeData = await freeRes.json().catch(() => ({}));

        if (!freeRes.ok || !freeData?.success) {
          console.warn('[Subscription] Server response warning:', freeData?.error);
        }

        // Update local profile store
        daheejStore.updateProfile(currentProfile.id, {
          subscription_tier: tier,
          membership_tier: tier,
          is_early_adopter: isEarlyDiamondClaim || Boolean(freeData.is_early_adopter),
        });

        try {
          await supabase
            .from('profiles')
            .update({
              subscription_tier: tier,
              subscription_status: 'active',
              is_early_adopter: isEarlyDiamondClaim || Boolean(freeData.is_early_adopter),
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentProfile.id);
        } catch (dbErr) {
          console.warn('[Subscription] Profile update note:', dbErr);
        }

        onSubscriptionUpdated();
        setSuccessMessage(
          freeData.message ||
            `Alhamdulillah! Free activation successful: ${SUBSCRIPTION_PLANS[tier].name}${
              appliedCoupon ? ` (Promo ${appliedCoupon.code} applied)` : ''
            }.`
        );

        try {
          confetti({
            particleCount: 110,
            spread: 85,
            origin: { y: 0.6 },
          });
        } catch (e) {}

        setTimeout(() => {
          onClose();
        }, 1600);
        setLoadingTier(null);
        return;
      }

      // =========================================================================
      // STANDARD PAID CHECKOUT FLOW (price > ₹0):
      // Calls /api/payments/create-order with server-verified discounted amount
      // =========================================================================
      const amountPaise = discountedPriceINR * 100;
      const interval = billingCycle;

      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          amount: amountPaise,
          interval,
          billingCycle,
          couponCode: isCouponValidForTier ? appliedCoupon?.code : undefined,
          profileId: currentProfile?.id || '',
          userId: currentProfile?.id || '',
          currency: 'INR',
        }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json().catch(() => ({}));
        setErrorMessage(data?.error || data?.message || `Payment order initiation failed (HTTP ${orderRes.status})`);
        setLoadingTier(null);
        return;
      }

      const orderData = await orderRes.json().catch(() => ({}));

      if (!orderData || !orderData.success) {
        setErrorMessage(orderData?.error || 'Order creation failed on server');
        setLoadingTier(null);
        return;
      }

      // Handle server-simulated or free response
      if (orderData.isFree || orderData.isSimulated) {
        daheejStore.updateProfile(currentProfile.id, {
          subscription_tier: tier,
          membership_tier: tier,
        });

        try {
          await supabase
            .from('profiles')
            .update({
              subscription_tier: tier,
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentProfile.id);
        } catch (dbErr) {
          console.warn('[Subscription] Profile update note:', dbErr);
        }

        onSubscriptionUpdated();
        setSuccessMessage(
          `Alhamdulillah! Subscription upgraded to ${SUBSCRIPTION_PLANS[tier].name}${
            appliedCoupon ? ` (Promo ${appliedCoupon.code} applied)` : ''
          }.`
        );

        try {
          confetti({
            particleCount: 110,
            spread: 85,
            origin: { y: 0.6 },
          });
        } catch (e) {}

        setTimeout(() => {
          onClose();
        }, 1600);
        setLoadingTier(null);
        return;
      }

      // Dynamically load official Razorpay SDK script for paid checkout
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay payment gateway script could not be loaded. Please check your internet connection.');
      }

      // Launch official Razorpay Checkout Modal
      const orderId = orderData.order_id || orderData.id;
      const keyId = orderData.key_id || orderData.keyId;

      if (!orderId || !keyId) {
        throw new Error('Server order response did not provide a valid order_id or key_id.');
      }

      const rzpOptions = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'DaheejFree Matrimonial',
        description: `${SUBSCRIPTION_PLANS[tier].name} (${billingCycle}) - 100% Dowry Free`,
        image: '/icon.svg',
        order_id: orderId,
        handler: async function (response: any) {
          console.info('[Razorpay] Payment successful:', response);
          daheejStore.updateProfile(currentProfile.id, {
            subscription_tier: tier,
            membership_tier: tier,
          });

          try {
            await supabase
              .from('profiles')
              .update({
                subscription_tier: tier,
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', currentProfile.id);
          } catch (dbErr) {
            console.warn('[Subscription] Profile update note:', dbErr);
          }

          onSubscriptionUpdated();
          setSuccessMessage(`Alhamdulillah! Subscription upgraded to ${SUBSCRIPTION_PLANS[tier].name}.`);

          try {
            confetti({
              particleCount: 100,
              spread: 80,
              origin: { y: 0.6 },
            });
          } catch (e) {}

          setTimeout(() => {
            onClose();
          }, 1500);
        },
        prefill: {
          name: currentProfile.full_name || '',
          email: currentProfile.wali_email || '',
          contact: currentProfile.wali_phone || '',
        },
        notes: {
          profile_id: currentProfile.id,
          tier: tier,
          billing_cycle: billingCycle,
          coupon: appliedCoupon?.code || '',
        },
        theme: {
          color: '#059669',
        },
        modal: {
          ondismiss: function () {
            setLoadingTier(null);
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(rzpOptions);
      razorpayInstance.open();
    } catch (err: any) {
      console.error('[SubscriptionModal] Checkout error:', err);
      setErrorMessage(err?.message || 'Failed to initiate payment checkout.');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label="Close pricing modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Shield className="w-3.5 h-3.5" />
            Shariah-Compliant Matrimony
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
            Choose Your Matrimonial Plan
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Transparent plans to connect with righteous families without dowry or hidden fees.
          </p>

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Founder's Reward Banner: First 30 Users Free Diamond */}
        {!isEarlyAdopter && userLevel === 0 && ((earlyAccessInfo?.claimed_count ?? 0) < 30) && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-zinc-900 to-teal-950/90 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 flex items-center justify-center font-extrabold shadow-md shrink-0">
                <Gift className="w-5 h-5 text-zinc-950" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  🎉 Founder's Reward: Free Diamond Membership for the first 30 users!
                </h4>
                <p className="text-xs text-zinc-300 mt-1">
                  {Math.max(0, 30 - (earlyAccessInfo?.claimed_count || 0))} of 30 spots remaining. Claim your 100% free Diamond upgrade now.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClaimEarlyAccess}
              disabled={isClaimingEarlyAccess}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-white text-xs font-bold shadow-md cursor-pointer shrink-0 transition-all flex items-center gap-1.5"
            >
              {isClaimingEarlyAccess ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Crown className="w-3.5 h-3.5" />
                  <span>Claim Free Diamond</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center mb-6">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                billingCycle === 'yearly'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Yearly
              <span className="text-[9px] bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-1 py-0.2 rounded font-bold">
                20% OFF
              </span>
            </button>
          </div>
        </div>

        {/* 3 Tier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visibleTiers.map((t) => {
            const plan = SUBSCRIPTION_PLANS[t];
            const planLevel = TIER_LEVELS[t] ?? 0;
            const isCurrent = planLevel === userLevel;
            const isIncluded = planLevel < userLevel;
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
            let finalPrice = Math.max(0, Math.round(basePrice * (1 - discountPercent / 100)));

            const isEarlyDiamondFree = isEarlyAdopterEligible && isDiamond;
            if (isEarlyDiamondFree) {
              finalPrice = 0;
            }

            const hasDiscount = discountPercent > 0 || isEarlyDiamondFree;
            const isFullyDiscounted = hasDiscount && finalPrice === 0;

            const isButtonDisabled = isCurrent || isIncluded || isLoading;

            return (
              <div
                key={t}
                className={`rounded-2xl p-5 flex flex-col justify-between relative border transition-all ${
                  isDiamond
                    ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-lg'
                    : isGold
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50/10 dark:bg-amber-950/10'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                }`}
              >
                {isDiamond && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[9px] font-extrabold uppercase py-0.5 px-3 rounded-full shadow">
                    {isEarlyDiamondFree ? "Founder's Free Diamond" : "Complete Plan"}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                      {plan.name}
                    </h3>
                    {isDiamond ? (
                      <Crown className="w-4 h-4 text-emerald-600" />
                    ) : isGold ? (
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Shield className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>

                  <div className="my-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-baseline gap-2">
                      {hasDiscount && basePrice > 0 && (
                        <span className="text-sm font-semibold line-through text-zinc-500">
                          ₹{basePrice.toLocaleString()}
                        </span>
                      )}
                      <span className="text-2xl font-extrabold text-zinc-900 dark:text-white">
                        {finalPrice === 0 ? 'Free' : `₹${finalPrice.toLocaleString()}`}
                      </span>
                      {hasDiscount && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          {isEarlyDiamondFree ? "Founder's Reward" : `${discountPercent}% OFF`}
                        </span>
                      )}
                      {finalPrice > 0 && (
                        <span className="text-xs text-zinc-400">
                          /{billingCycle === 'yearly' ? 'yr' : 'mo'}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  id={`btn-plan-${t}`}
                  data-action="select-plan"
                  data-testid={`select-plan-${t}`}
                  aria-label={
                    isCurrent
                      ? 'Current Plan'
                      : isIncluded
                      ? 'Included in Your Plan'
                      : isEarlyDiamondFree
                      ? 'Claim Free Diamond'
                      : isFullyDiscounted
                      ? 'Claim Free Subscription'
                      : `Select Plan ${plan.name}`
                  }
                  onClick={() => handleSelectPlan(t)}
                  disabled={isButtonDisabled}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                    isButtonDisabled
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-700'
                      : isFullyDiscounted
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md active:scale-98 cursor-pointer ring-2 ring-emerald-400/50'
                      : isDiamond
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-98 cursor-pointer'
                      : isGold
                      ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold active:scale-98 cursor-pointer'
                      : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 cursor-pointer'
                  }`}
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                  ) : isCurrent ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      Current Plan
                    </span>
                  ) : isIncluded ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-zinc-400" />
                      Included in Your Plan
                    </span>
                  ) : isEarlyDiamondFree ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      Claim Free Diamond
                    </span>
                  ) : isFullyDiscounted ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      Claim Free Subscription
                    </span>
                  ) : (
                    <span>Upgrade Plan</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Promo / Discount Coupon Section (Positioned Below Pricing Cards) */}
        <div className="mt-6 p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Have a promo code?
              </span>
              {appliedCoupon && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                  {appliedCoupon.code} ({appliedCoupon.discount_percent}% OFF)
                </span>
              )}
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
                  className="w-36 sm:w-44 px-3 py-1.5 text-xs font-mono font-bold tracking-wider rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isValidatingCoupon || !couponCodeInput.trim()}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
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
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 text-[10px] text-zinc-500 dark:text-zinc-400">
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

        <div className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 mt-6 flex items-center justify-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" />
          <span>Secure checkout powered by Razorpay (Server-Verified Orders & Promo Discounts)</span>
        </div>
      </div>
    </div>
  );
};
