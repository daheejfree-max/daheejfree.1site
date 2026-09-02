'use client';

// ==============================================================================
// 3-TIER SUBSCRIPTION MODAL WITH DODO PAYMENTS (PRODUCTION MODE)
// Strictly 3 Tiers: Free (Upgraded), Gold, and Diamond
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SubscriptionTier, BillingCycle, Profile } from '../../types';
import { SUBSCRIPTION_PLANS, initiateDodoCheckout } from '../../lib/dodoPayments';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
  currentProfile: Profile | null;
  onSubscriptionUpdated: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  currentProfile,
  onSubscriptionUpdated,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const visibleTiers: SubscriptionTier[] = ['free', 'gold', 'diamond'];

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (!currentProfile) return;
    setLoadingTier(tier);
    setSuccessMessage(null);
    setErrorMessage(null);

    const res = await initiateDodoCheckout({
      tier,
      billingCycle,
      profileId: currentProfile.id,
      customerEmail: currentProfile.wali_email || undefined,
      customerName: currentProfile.full_name,
    });

    setLoadingTier(null);

    if (res.success) {
      if (!res.checkoutUrl) {
        onSubscriptionUpdated();
        setSuccessMessage(
          tier === 'free'
            ? 'Plan switched to Free Basic.'
            : `Alhamdulillah! Upgraded to ${SUBSCRIPTION_PLANS[tier].name}.`
        );
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch (e) {}

        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } else {
      setErrorMessage(res.error || 'Failed to initiate Dodo Payments checkout.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
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
            const isCurrent = currentTier === t || (t === 'diamond' && currentTier === 'platinum');
            const isDiamond = t === 'diamond';
            const isGold = t === 'gold';
            const isLoading = loadingTier === t;

            const price =
              billingCycle === 'yearly' && plan.priceINR > 0
                ? Math.round(plan.priceINR * 9.6)
                : plan.priceINR;

            return (
              <div
                key={t}
                className={`rounded-2xl p-5 flex flex-col justify-between relative border ${
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
                  onClick={() => handleSelectPlan(t)}
                  disabled={isCurrent || isLoading}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                      : isDiamond
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                      : isGold
                      ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold'
                      : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900'
                  }`}
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : (
                    'Select Plan'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 mt-6 flex items-center justify-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" />
          <span>Production Payments powered by Dodo Payments</span>
        </div>
      </div>
    </div>
  );
};
