'use client';

// ==============================================================================
// DAHEEJFREE - LEGAL HUB (TERMS, PRIVACY & REFUND POLICIES)
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { LegalPolicies, LegalPolicyTab } from '../../components/legal/LegalPolicies';

export default function LegalHubPage() {
  const [tab, setTab] = useState<LegalPolicyTab>('terms');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'privacy' || tabParam === 'refund' || tabParam === 'terms') {
        setTab(tabParam);
      }
    }
  }, []);

  return <LegalPolicies initialTab={tab} />;
}
