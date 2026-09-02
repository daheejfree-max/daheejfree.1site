'use client';

// ==============================================================================
// ACCEPTED MATCHES ROUTE (src/app/matches/accepted/page.tsx)
// ==============================================================================

import React from 'react';
import { AcceptedMatchesView } from '../../../components/matches/AcceptedMatchesView';
import { useAuth } from '../../../hooks/useAuth';

export default function AcceptedMatchesPage({
  onNavigateChat,
  onOpenPricing,
  onStartCall,
  onExploreDiscover,
}: {
  onNavigateChat?: (partnerId: string) => void;
  onOpenPricing?: () => void;
  onStartCall?: (partnerId: string, type: 'voice' | 'video') => void;
  onExploreDiscover?: () => void;
}) {
  const { profile, tier, allProfiles } = useAuth();

  return (
    <div className="py-8">
      <AcceptedMatchesView
        currentUserId={profile?.id || null}
        currentProfile={profile}
        tier={tier}
        allProfiles={allProfiles || []}
        onNavigateChat={onNavigateChat}
        onOpenPricing={onOpenPricing}
        onStartCall={onStartCall}
        onExploreDiscover={onExploreDiscover}
      />
    </div>
  );
}
