'use client';

// ==============================================================================
// DISCOVER MATCHES ROUTE (src/app/matches/page.tsx)
// ==============================================================================

import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePhotoConsent } from '../../hooks/usePhotoConsent';
import { useConnections } from '../../hooks/useConnections';
import { ProfileGridSkeleton } from '../../components/profiles/ProfileSkeleton';
import { ProfileCard } from '../../components/profiles/ProfileCard';

export default function MatchesPage({
  onNavigateChat,
  onOpenPricing,
  onStartCall,
}: {
  onNavigateChat?: (partnerId: string) => void;
  onOpenPricing?: () => void;
  onStartCall?: (partnerId: string, type: 'voice' | 'video') => void;
}) {
  const { profile, tier, allProfiles, isLoading } = useAuth();
  const currentUserId = profile?.id || null;
  const { getConsentStatus, sendRequest: sendPhotoRequest } = usePhotoConsent(currentUserId);
  const { getConnectionPairStatus, sendMatchRequest, respondToMatch } = useConnections(currentUserId);

  if (isLoading) {
    return (
      <div className="py-8 max-w-7xl mx-auto px-4">
        <ProfileGridSkeleton count={6} />
      </div>
    );
  }

  // Filter out self and non-active candidates
  const filteredCandidates = (allProfiles || []).filter((p) => p.id !== currentUserId && p.kyc_status !== 'banned');

  return (
    <div className="py-8 max-w-7xl mx-auto px-4 space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
          Discover Nikah Matches
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
          Verified profiles adhering to 100% Dowry-Free Islamic Marriage covenant.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCandidates.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            viewerProfile={profile!}
            viewerTier={tier}
            isSelf={p.id === profile?.id}
            consentStatus={getConsentStatus(p.id)}
            connectionPairStatus={getConnectionPairStatus(p.id)}
            onSendConnectionRequest={async (targetId) => {
              await sendMatchRequest(targetId);
            }}
            onRespondConnection={async (targetId, status) => {
              await respondToMatch(targetId, status);
            }}
            onSendConsentRequest={async (targetId) => {
              await sendPhotoRequest(targetId);
            }}
            onOpenWaliModal={() => {}}
            onOpenPricing={onOpenPricing || (() => {
              if (typeof window !== 'undefined') window.location.href = '/pricing';
            })}
            onStartCall={onStartCall || (() => {})}
            onOpenChat={(chatProfile) => {
              if (onNavigateChat) onNavigateChat(chatProfile.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
