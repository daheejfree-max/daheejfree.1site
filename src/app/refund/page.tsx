'use client';

// ==============================================================================
// DAHEEJFREE - STRICT REFUND & SUBSCRIPTION POLICY
// ==============================================================================

import React from 'react';
import { LegalPolicies } from '../../components/legal/LegalPolicies';

interface LegalPageProps {
  onBack?: () => void;
}

export default function RefundPolicyPage({ onBack }: LegalPageProps) {
  return <LegalPolicies initialTab="refund" onBack={onBack} />;
}
