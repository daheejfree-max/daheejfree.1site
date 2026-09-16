'use client';

// ==============================================================================
// MATCHMAKING DISCOVERY FEED (BLURRED PHOTOS WITH 2-WAY CONSENT & WALI GATING)
// Production-Ready Nikah Candidate Feed
// ==============================================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  CheckCircle,
  Shield,
  Heart,
  Lock,
  Eye,
  Crown,
  Sparkles,
  Phone,
  Video,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { usePhotoConsent } from '../../../hooks/usePhotoConsent';
import { useConnections } from '../../../hooks/useConnections';
import { ProfileCard } from '../../../components/profiles/ProfileCard';
import { ProfileGridSkeleton } from '../../../components/profiles/ProfileSkeleton';
import { PhotoConsentModal } from '../../../components/profiles/PhotoConsentModal';
import { WaliContactModal } from '../../../components/profiles/WaliContactModal';
import { ChatWindow } from '../../../components/chat/ChatWindow';
import { daheejStore } from '../../../lib/supabase/store';
import { supabase } from '../../../lib/supabase/client';
import { ProfileSecureView, SubscriptionTier } from '../../../types';

export default function MatchesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [kycOnly, setKycOnly] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveDbProfiles, setLiveDbProfiles] = useState<ProfileSecureView[] | null>(null);
  const [activeConsentProfile, setActiveConsentProfile] = useState<ProfileSecureView | null>(null);
  const [activeWaliProfile, setActiveWaliProfile] = useState<ProfileSecureView | null>(null);
  const [activeChatProfile, setActiveChatProfile] = useState<ProfileSecureView | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { profile: currentProfile, tier, isLoading: authLoading } = useAuth();
  const currentUserId = currentProfile?.id || null;

  const { startCall } = useWebRTC(currentUserId);
  const {
    getConsentStatus,
    sendRequest: sendPhotoRequest,
    revokeConsent,
    grantInstantConsent,
  } = usePhotoConsent(currentUserId);
  const {
    getConnectionPairStatus,
    sendMatchRequest,
    respondToMatch,
  } = useConnections(currentUserId);

  // 1. Fetch live match candidate profiles from Supabase with strict filtering
  const fetchLiveCandidates = useCallback(async () => {
    if (!currentUserId) return;
    setIsRefreshing(true);

    try {
      // Base query strictly excluding self and inactive/banned profiles
      let query = supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserId)
        .eq('is_active', true);

      // Default to opposite gender based on user's registered gender
      const userGender = (currentProfile?.gender || '').toLowerCase();
      if (userGender === 'male' || userGender === 'brother') {
        query = query.or('gender.eq.female,gender.eq.Sister');
      } else if (userGender === 'female' || userGender === 'sister') {
        query = query.or('gender.eq.male,gender.eq.Brother');
      }

      const { data, error } = await query;

      if (!error && data) {
        const mapped: ProfileSecureView[] = data.map((p: any) => {
          const consentStatus = getConsentStatus(p.id);
          const hasPhotoAccess = consentStatus === 'accepted' || (consentStatus as string) === 'approved';
          const isDiamondViewer = tier === 'diamond';
          const normGender = (p.gender === 'male' || p.gender === 'Brother') ? 'male' : 'female';

          const hasRealAvatar = Boolean(p.avatar_url && !p.avatar_url.includes('placeholder'));
          const fallbackGenderAvatar = normGender === 'female'
            ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80';

          return {
            id: p.id,
            full_name: p.full_name || 'Candidate',
            gender: normGender,
            age: p.age || 24,
            profession: p.profession?.trim() || 'Profession Not Specified',
            location: (p.city || p.location)?.trim() || 'Location Not Specified',
            city: (p.city || p.location)?.trim() || 'Location Not Specified',
            kyc_status: p.kyc_status || 'unverified',
            is_verified: Boolean(p.is_verified || p.kyc_status === 'verified' || p.selfie_verified),
            selfie_verified: Boolean(p.selfie_verified),
            membership_tier: (p.membership_tier as SubscriptionTier) || (p.subscription_tier as SubscriptionTier) || 'free',
            subscription_tier: (p.subscription_tier as SubscriptionTier) || (p.membership_tier as SubscriptionTier) || 'free',
            dowry_pledge_signed: Boolean(p.dowry_pledge_signed ?? p.anti_dowry_pledged ?? true),
            anti_dowry_pledged: Boolean(p.dowry_pledge_signed ?? p.anti_dowry_pledged ?? true),
            // Real photo exposed ONLY if photo consent is accepted/approved
            avatar_url: hasPhotoAccess ? (hasRealAvatar ? p.avatar_url : fallbackGenderAvatar) : undefined,
            photo_blur_hash: p.photo_blur_hash || 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
            photo_privacy: Boolean(p.photo_privacy ?? true),
            has_photo_consent: hasPhotoAccess,
            has_wali: Boolean(p.has_wali || p.wali_contact_number || p.wali_phone || p.wali_email || p.wali_name),
            wali_name: p.wali_name || null,
            wali_phone: p.wali_contact_number || p.wali_phone || null,
            wali_contact_number: p.wali_contact_number || p.wali_phone || null,
            wali_email: isDiamondViewer ? (p.wali_email || `${p.id}@daheejfree.org`) : (p.wali_email || null),
            sect: p.sect || null,
            prayer_frequency: p.prayer_frequency || null,
            bio: p.bio || null,
            education: p.education || null,
            created_at: p.created_at || new Date().toISOString(),
            updated_at: p.updated_at || new Date().toISOString(),
          };
        });

        setLiveDbProfiles(mapped);
      }
    } catch (err) {
      console.error('[MatchesPage] Candidate discovery query notice:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUserId, currentProfile?.gender, tier, getConsentStatus]);

  // Initial fetch on mount or user change
  useEffect(() => {
    fetchLiveCandidates();
  }, [fetchLiveCandidates]);

  // Compute feed filtering out banned and self profiles, plus dynamic search/gender filters
  const profiles = useMemo(() => {
    if (!currentUserId) return [];
    const feed = liveDbProfiles || daheejStore.getSecureProfiles(currentUserId);

    const myGender = (currentProfile?.gender || '').toLowerCase() === 'male' ? 'male' : 'female';
    const targetGender = myGender === 'male' ? 'female' : 'male';

    return feed.filter((p) => {
      // 1. Strict self-exclusion & active status check
      if (p.id === currentUserId || p.kyc_status === 'banned') return false;

      // 2. Gender filtering
      if (genderFilter === 'all') {
        if (currentProfile?.gender && p.gender !== targetGender) {
          return false;
        }
      } else {
        if (p.gender !== genderFilter) return false;
      }

      // 3. KYC Verified Filter
      if (kycOnly && p.kyc_status !== 'verified' && !p.is_verified) return false;

      // 4. Search Filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          p.full_name.toLowerCase().includes(q) ||
          (p.profession && p.profession.toLowerCase().includes(q)) ||
          (p.location && p.location.toLowerCase().includes(q)) ||
          (p.sect && p.sect.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [currentUserId, liveDbProfiles, currentProfile, genderFilter, kycOnly, searchTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Search & Filter Top Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
            <input
              id="match-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, profession, city, sect..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <div className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 flex items-center gap-1 text-xs">
              <button
                id="filter-all-candidates"
                type="button"
                onClick={() => setGenderFilter('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  genderFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Recommended Matches
              </button>
              <button
                id="filter-sister-candidates"
                type="button"
                onClick={() => setGenderFilter('female')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  genderFilter === 'female'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Sisters (Brides)
              </button>
              <button
                id="filter-brother-candidates"
                type="button"
                onClick={() => setGenderFilter('male')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  genderFilter === 'male'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Brothers (Grooms)
              </button>
            </div>

            <button
              id="filter-kyc-only"
              type="button"
              onClick={() => setKycOnly(!kycOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                kycOnly
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600'
                  : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Verified KYC Only
            </button>

            <button
              id="btn-refresh-feed"
              type="button"
              onClick={() => fetchLiveCandidates()}
              disabled={isRefreshing}
              title="Refresh Discovery Feed"
              className="p-2 rounded-xl text-xs font-semibold bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Profiles Grid */}
      {!isMounted || authLoading ? (
        <ProfileGridSkeleton count={6} />
      ) : profiles.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center shadow-sm">
          <Users className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">No matching profiles found</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Try adjusting your search criteria or gender filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((candidate) => (
            <ProfileCard
              key={candidate.id}
              profile={candidate}
              viewerProfile={currentProfile!}
              viewerTier={tier}
              isSelf={candidate.id === currentUserId}
              consentStatus={getConsentStatus(candidate.id)}
              connectionPairStatus={getConnectionPairStatus(candidate.id)}
              onSendConnectionRequest={async (targetId) => {
                await sendMatchRequest(targetId);
                // Asynchronously dispatch notification with Wali routing
                try {
                  const targetProfile = profiles.find((p) => p.id === targetId) || daheejStore.getProfileById(targetId);
                  const recipientEmail = (targetProfile as any)?.email || (targetProfile as any)?.user_email || targetProfile?.wali_email || `${targetId}@daheejfree.site`;
                  const waliEmail = targetProfile?.wali_email || null;

                  fetch('/api/notifications/proposal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      recipientEmail,
                      waliEmail,
                      senderName: currentProfile?.full_name || 'A prospective candidate',
                      senderCity: currentProfile?.location || (currentProfile as any)?.city || 'India',
                      candidateName: targetProfile?.full_name || 'Candidate',
                    }),
                  }).catch((err) => console.warn('Proposal notification notice:', err));
                } catch (notifyErr) {
                  console.warn('Proposal notification catch:', notifyErr);
                }
              }}
              onRespondConnection={async (targetId, status) => {
                await respondToMatch(targetId, status);
              }}
              onSendConsentRequest={() => setActiveConsentProfile(candidate)}
              onOpenWaliModal={setActiveWaliProfile}
              onOpenPricing={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/pricing';
                }
              }}
              onStartCall={startCall}
              onOpenChat={(target) => setActiveChatProfile(target)}
            />
          ))}
        </div>
      )}

      {/* 2-Way Consent Modal */}
      <PhotoConsentModal
        isOpen={Boolean(activeConsentProfile)}
        onClose={() => setActiveConsentProfile(null)}
        targetProfile={activeConsentProfile}
        consentStatus={activeConsentProfile ? getConsentStatus(activeConsentProfile.id) : 'none'}
        onRequestConsent={async (id) => {
          await sendPhotoRequest(id);
          fetchLiveCandidates();
        }}
        onRevokeConsent={async (id) => {
          await revokeConsent(id);
          fetchLiveCandidates();
        }}
        onInstantGrant={async (id) => {
          await grantInstantConsent(id);
          fetchLiveCandidates();
        }}
      />

      {/* Direct Wali Contact Modal */}
      <WaliContactModal
        targetProfile={activeWaliProfile}
        currentProfile={currentProfile}
        onClose={() => setActiveWaliProfile(null)}
      />

      {/* Realtime Moderated Chat */}
      {activeChatProfile && (
        <ChatWindow
          currentProfile={currentProfile}
          targetProfile={activeChatProfile}
          viewerTier={tier}
          onClose={() => setActiveChatProfile(null)}
          onStartCall={startCall}
          onOpenPricing={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/pricing';
            }
          }}
        />
      )}
    </div>
  );
}
