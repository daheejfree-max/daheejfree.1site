'use client';

// ==============================================================================
// PRICING PAGE: 3-TIER MATRIX WITH DODO PAYMENTS PRODUCTION INTEGRATION
// ==============================================================================

import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { PricingView } from '../../../components/pricing/PricingView';
import { Logo } from '../../../components/brand/Logo';

export default function PricingPage() {
  const { profile: currentProfile, tier: activeTier, refreshState } = useAuth();

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <PricingView
          currentTier={activeTier || 'free'}
          currentProfile={currentProfile}
          onSubscriptionUpdated={() => {
            refreshState();
          }}
          onNavigateRegister={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
        />
      </div>
    </div>
  );
}
