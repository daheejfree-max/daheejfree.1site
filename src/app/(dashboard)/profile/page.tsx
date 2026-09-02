'use client';

// ==============================================================================
// NEXT.JS APP ROUTER: USER PROFILE & WALI SETTINGS PAGE
// ==============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { KYCVerification } from '../../../components/dashboard/KYCVerification';
import { SubscriptionModal } from '../../../components/subscriptions/SubscriptionModal';

export default function ProfilePage() {
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const {
    profile: currentProfile,
    tier,
    updateCurrentProfile,
    submitKYC,
    refreshState,
  } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <KYCVerification
        profile={currentProfile}
        tier={tier}
        onUpdateProfile={updateCurrentProfile}
        onSubmitKYC={submitKYC}
        onOpenPricing={() => setIsPricingOpen(true)}
        onAccountDeleted={() => {
          window.location.href = '/';
        }}
      />

      <SubscriptionModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        currentTier={tier}
        currentProfile={currentProfile}
        onSubscriptionUpdated={refreshState}
      />
    </div>
  );
}
