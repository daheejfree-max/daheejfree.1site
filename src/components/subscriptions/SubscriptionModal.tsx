'use client';

// ==============================================================================
// 3-TIER SUBSCRIPTION MODAL (DAHEEJFREE MATRIMONIAL PLATFORM)
// Strictly 3 Tiers: Free (Sunnah Base), Gold, and Diamond
// Strictly Prevents Plan Degradation & Uses /api/payments/create-order Endpoint
// ==============================================================================

import React, { useState } from 'react';
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

  if (!isOpen) return null;

  const visibleTiers: SubscriptionTier[] = ['free', 'gold', 'diamond'];

  // Read current user's profile state to determine exact tier level
  const userTier = (currentProfile?.subscription_tier || currentTier || 'free').toLowerCase();
  const userLevel = TIER_LEVELS[userTier] ?? 0;

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
      // Calculate exact plan pricing
      const planConfig = SUBSCRIPTION_PLANS[tier];
      const planAmount =
        billingCycle === 'yearly' && planConfig?.priceINR > 0
          ? Math.round(planConfig.priceINR * 9.6)
          : (planConfig?.priceINR || 0);
      const amount = planAmount * 100;
      const interval = billingCycle;

      // 1. Fetch server-generated order from /api/payments/create-order
      // Passes required payload: { tier, amount, interval }
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          amount,
          interval,
          billingCycle,
          profileId: currentProfile?.id || '',
          userId: currentProfile?.id || '',
          currency: 'INR',
        }),
      });

      const orderData = await orderRes.json().catch(() => ({}));

      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || `Payment order initiation failed (HTTP ${orderRes.status})`);
      }

      // 2. Dynamically load official Razorpay SDK script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay payment gateway script could not be loaded. Please check your internet connection.');
      }

      // Handle free or simulated/test sandbox orders directly
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
        setLoadingTier(null);
        return;
      }

      // 3. Launch official Razorpay Checkout Modal
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
        <div className="text-center space-y-2 mb-8">
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

          {/* Billing Toggle */}
          <div className="flex items-center justify-center pt-2">
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
        </div>

        {/* 3 Tier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visibleTiers.map((t) => {
            const plan = SUBSCRIPTION_PLANS[t];
            const planLevel = TIER_LEVELS[t] ?? 0;
            const isCurrent = planLevel === userLevel;
            const isIncluded = planLevel < userLevel;
            const isUpgrade = planLevel > userLevel;
            const isDiamond = t === 'diamond';
            const isGold = t === 'gold';
            const isLoading = loadingTier === t;

            const price =
              billingCycle === 'yearly' && plan.priceINR > 0
                ? Math.round(plan.priceINR * 9.6)
                : plan.priceINR;

            // Plan button state & label logic strictly following requirement:
            // - plan.level === user.level: Disable button, label it "Current Plan"
            // - plan.level < user.level: Disable button, label it "Included in Your Plan" (prevent degradation)
            // - plan.level > user.level: Keep button active, label it "Upgrade Plan"
            let buttonLabel = 'Upgrade Plan';
            if (isLoading) {
              buttonLabel = 'Processing...';
            } else if (isCurrent) {
              buttonLabel = 'Current Plan';
            } else if (isIncluded) {
              buttonLabel = 'Included in Your Plan';
            } else {
              buttonLabel = 'Upgrade Plan';
            }

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
                    Complete Plan
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
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-zinc-900 dark:text-white">
                        {price === 0 ? 'Free' : `₹${price.toLocaleString()}`}
                      </span>
                      {price > 0 && (
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
                  aria-label={isCurrent ? 'Current Plan' : isIncluded ? 'Included in Your Plan' : `Select Plan ${plan.name}`}
                  onClick={() => handleSelectPlan(t)}
                  disabled={isButtonDisabled}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                    isButtonDisabled
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-700'
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
                  ) : (
                    <span>Upgrade Plan</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 mt-6 flex items-center justify-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" />
          <span>Secure checkout powered by Razorpay (Server Order Integration)</span>
        </div>
      </div>
    </div>
  );
};
