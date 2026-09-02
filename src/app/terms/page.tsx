'use client';

// ==============================================================================
// DAHEEJFREE - TERMS OF SERVICE & USER COVENANT (IT ACT SEC 79)
// ==============================================================================

import React from 'react';
import { LegalPolicies } from '../../components/legal/LegalPolicies';

interface LegalPageProps {
  onBack?: () => void;
}

export default function TermsOfServicePage({ onBack }: LegalPageProps) {
  return <LegalPolicies initialTab="terms" onBack={onBack} />;
}
