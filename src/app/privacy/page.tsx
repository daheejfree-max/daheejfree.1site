'use client';

// ==============================================================================
// DAHEEJFREE - PRIVACY POLICY & DATA SECURITY (DPDP ACT & DIDIT KYC)
// ==============================================================================

import React from 'react';
import { LegalPolicies } from '../../components/legal/LegalPolicies';

interface LegalPageProps {
  onBack?: () => void;
}

export default function PrivacyPolicyPage({ onBack }: LegalPageProps) {
  return <LegalPolicies initialTab="privacy" onBack={onBack} />;
}
