'use client';

// ==============================================================================
// 3-TIER PRICING VIEW WITH DODO PAYMENTS PRODUCTION INTEGRATION
// Strictly 3 Tiers: Free (Upgraded), Gold, and Diamond
// ==============================================================================

import React, { useState } from 'react';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SubscriptionTier, BillingCycle, Profile } from '../../types';
import { SUBSCRIPTION_PLANS, initiateDodoCheckout } from '../../lib/dodoPayments';

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
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter to strict 3 tiers
  const visibleTiers: SubscriptionTier[] = ['free', 'gold', 'diamond'];

  const handleUpgrade = async (tierName: SubscriptionTier) => {
    if (!currentProfile) {
      if (onNavigateRegister) {
        onNavigateRegister();
      }
      return;
    }

    setLoadingTier(tierName);
    setSuccessMessage(null);
    setErrorMessage(null);

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
        setSuccessMessage(
          tierName === 'free'
            ? 'Plan successfully switched to Free Basic.'
            : `Alhamdulillah! Subscription upgraded to ${SUBSCRIPTION_PLANS[tierName].name}.`
        );
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
      setErrorMessage(res.error || 'Failed to initiate Dodo Payments checkout.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-6 px-4">
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

        {/* Billing Cycle Switch */}
        <div className="flex items-center justify-center pt-2">
          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl flex items-center gap-1 shadow-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
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
        </div>
      </div>

      {/* 3 Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {visibleTiers.map((t) => {
          const plan = SUBSCRIPTION_PLANS[t];
          const isCurrent = Boolean(currentProfile) && (currentTier === t || (t === 'diamond' && currentTier === 'platinum'));
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
                  Most Complete Matrimonial Plan
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
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">
                      {price === 0 ? 'Free' : `₹${price.toLocaleString()}`}
                    </span>
                    {price > 0 && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        /{billingCycle === 'yearly' ? 'year' : 'month'}
                      </span>
                    )}
                  </div>
                  {billingCycle === 'yearly' && price > 0 && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      Billed annually via Dodo Payments
                    </p>
                  )}
                </div>

                {/* Feature Checklist */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isDiamond
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : isGold
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span className="leading-snug">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div>
                <button
                  onClick={() => handleUpgrade(t)}
                  disabled={isCurrent || isLoading}
                  className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isCurrent
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-700'
                      : isDiamond
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 hover:scale-[1.01]'
                      : isGold
                      ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold shadow-md hover:scale-[1.01]'
                      : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                  }`}
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isCurrent ? (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      Active Plan
                    </span>
                  ) : (
                    <span>
                      {t === 'free' ? 'Switch to Free' : `Upgrade to ${plan.name}`}
                    </span>
                  )}
                </button>
                <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 mt-2.5">
                  <CreditCard className="w-3 h-3" />
                  <span>Secure checkout via Dodo Payments</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
