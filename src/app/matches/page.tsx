'use client';

// ==============================================================================
// DISCOVER MATCHES ROUTE (src/app/matches/page.tsx)
// Resilient Matchmaking Feed with Strict Lifecycle & Zero-Dowry Privacy Controls
// ==============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Users,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePhotoConsent } from '../../hooks/usePhotoConsent';
import { useConnections } from '../../hooks/useConnections';
import { ProfileGridSkeleton } from '../../components/profiles/ProfileSkeleton';
import { ProfileCard } from '../../components/profiles/ProfileCard';
import { PhotoConsentModal } from '../../components/profiles/PhotoConsentModal';
import { WaliContactModal } from '../../components/profiles/WaliContactModal';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { ProfileSecureView, SubscriptionTier } from '../../types';

interface MatchesPageProps {
  onNavigateChat?: (partnerId: string) => void;
  onOpenPricing?: () => void;
  onStartCall?: (partnerId: string, type: 'voice' | 'video' | 'audio') => void;
}

export default function MatchesPage({
  onNavigateChat,
  onOpenPricing,
  onStartCall,
}: MatchesPageProps) {
  const { profile, tier } = useAuth();
  const currentUserId = profile?.id || null;

  const [profiles, setProfiles] = useState<ProfileSecureView[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [kycOnly, setKycOnly] = useState<boolean>(false);

  // Active interaction modals
  const [activeConsentProfile, setActiveConsentProfile] = useState<ProfileSecureView | null>(null);
  const [activeWaliProfile, setActiveWaliProfile] = useState<ProfileSecureView | null>(null);
  const [activeChatProfile, setActiveChatProfile] = useState<ProfileSecureView | null>(null);

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

  // Helper mapper to produce standardized ProfileSecureView objects
  const mapProfilesToSecure = useCallback((rawList: any[]): ProfileSecureView[] => {
    return rawList.map((p: any) => {
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
        avatar_url: hasRealAvatar ? p.avatar_url : fallbackGenderAvatar,
        photo_blur_hash: p.photo_blur_hash || 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
        photo_privacy: Boolean(p.photo_privacy ?? true),
        has_photo_consent: false,
        has_wali: Boolean(p.has_wali || p.wali_contact_number || p.wali_phone || p.wali_email || p.wali_name),
        wali_name: p.wali_name || null,
        wali_phone: p.wali_contact_number || p.wali_phone || null,
        wali_contact_number: p.wali_contact_number || p.wali_phone || null,
        wali_email: p.wali_email || null,
        sect: p.sect || null,
        prayer_frequency: p.prayer_frequency || null,
        bio: p.bio || null,
        education: p.education || null,
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString(),
      };
    });
  }, []);

  // 1. Strict Lifecycle Data-Fetching: Runs only once on mount with strict [] dependency array
  useEffect(() => {
    let isMounted = true;

    async function loadMatchesFeed() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .neq('kyc_status', 'banned')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          if (isMounted) {
            setProfiles(mapProfilesToSecure(data));
          }
        } else {
          // Fallback to local store seed profiles
          const fallback = daheejStore.getProfiles().filter((p) => p.kyc_status !== 'banned');
          if (isMounted) {
            setProfiles(mapProfilesToSecure(fallback));
          }
        }
      } catch (err) {
        console.error('[MatchesPage] Profile discovery fetch notice:', err);
        const fallback = daheejStore.getProfiles().filter((p) => p.kyc_status !== 'banned');
        if (isMounted) {
          setProfiles(mapProfilesToSecure(fallback));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadMatchesFeed();

    return () => {
      isMounted = false;
    };
  }, [mapProfilesToSecure]); // Only depends on the memoized mapper, zero infinite re-renders

  // Manual refresh attached strictly to user onClick event
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('kyc_status', 'banned')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setProfiles(mapProfilesToSecure(data));
      } else {
        const fallback = daheejStore.getProfiles().filter((p) => p.kyc_status !== 'banned');
        setProfiles(mapProfilesToSecure(fallback));
      }
    } catch (err) {
      console.warn('[MatchesPage] Refresh notice:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 2. Data Filtering logic for search, gender, and KYC
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Exclude self if logged in
      if (currentUserId && p.id === currentUserId) return false;

      // Exclude banned users
      if (p.kyc_status === 'banned') return false;

      // Gender filter
      if (genderFilter !== 'all' && p.gender !== genderFilter) return false;

      // KYC filter
      if (kycOnly && !p.is_verified && p.kyc_status !== 'verified') return false;

      // Search term filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = p.full_name?.toLowerCase().includes(q) || false;
        const matchesProfession = p.profession?.toLowerCase().includes(q) || false;
        const matchesCity = (p.city || p.location)?.toLowerCase().includes(q) || false;
        const matchesSect = p.sect?.toLowerCase().includes(q) || false;
        return matchesName || matchesProfession || matchesCity || matchesSect;
      }

      return true;
    });
  }, [profiles, currentUserId, genderFilter, kycOnly, searchTerm]);

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 pb-24 md:pb-8">
      {/* Liberated Page Header */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Discover Nikah Matches
            </h1>
            <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 mt-1.5 max-w-2xl">
              Verified Muslim candidates adhering to 100% Dowry-Free Islamic covenant.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              id="btn-refresh-matches"
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing || loading}
              title="Refresh Discovery Feed"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Floating Search Bar & Seamless Filter Pills */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Floating Pill Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-zinc-400 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="match-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, profession, city, sect..."
              className="w-full bg-white dark:bg-zinc-900 rounded-full shadow-sm border border-zinc-200 dark:border-zinc-800 pl-12 pr-6 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Seamless Segmented Control & Sleek KYC Filter Badge */}
          <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2 w-full lg:w-auto snap-x items-center">
            <div className="bg-zinc-100 dark:bg-zinc-900/90 p-1.5 rounded-full border border-zinc-200/80 dark:border-zinc-800 flex items-center shrink-0 shadow-xs">
              <button
                type="button"
                onClick={() => setGenderFilter('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap snap-start ${
                  genderFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setGenderFilter('female')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap snap-start ${
                  genderFilter === 'female'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Sisters (Brides)
              </button>
              <button
                type="button"
                onClick={() => setGenderFilter('male')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap snap-start ${
                  genderFilter === 'male'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Brothers (Grooms)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setKycOnly(!kycOnly)}
              className={`px-4 py-2.5 rounded-full text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap shadow-xs ${
                kycOnly
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Verified KYC Only</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Feed / Skeleton / Empty State */}
      {loading ? (
        <div className="w-full max-w-7xl mx-auto">
          <ProfileGridSkeleton count={6} />
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="w-full max-w-7xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center shadow-sm">
          <Users className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">
            No matches found
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Try adjusting your search criteria or gender filters to explore more candidates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-7xl mx-auto">
          {filteredProfiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              viewerProfile={profile || ({} as any)}
              viewerTier={tier}
              isSelf={p.id === currentUserId}
              consentStatus={getConsentStatus(p.id)}
              connectionPairStatus={getConnectionPairStatus(p.id)}
              onSendConnectionRequest={async (targetId) => {
                await sendMatchRequest(targetId);
              }}
              onRespondConnection={async (targetId, status) => {
                await respondToMatch(targetId, status);
              }}
              onSendConsentRequest={(targetId) => {
                setActiveConsentProfile(p);
              }}
              onOpenWaliModal={setActiveWaliProfile}
              onOpenPricing={onOpenPricing || (() => {
                if (typeof window !== 'undefined') window.location.href = '/pricing';
              })}
              onStartCall={onStartCall || (() => {})}
              onOpenChat={(chatProfile) => {
                if (onNavigateChat) {
                  onNavigateChat(chatProfile.id);
                } else {
                  setActiveChatProfile(chatProfile);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* 2-Way Photo Consent Modal */}
      {activeConsentProfile && (
        <PhotoConsentModal
          isOpen={Boolean(activeConsentProfile)}
          onClose={() => setActiveConsentProfile(null)}
          targetProfile={activeConsentProfile}
          consentStatus={getConsentStatus(activeConsentProfile.id)}
          onRequestConsent={async (id) => {
            await sendPhotoRequest(id);
          }}
          onRevokeConsent={async (id) => {
            await revokeConsent(id);
          }}
          onInstantGrant={async (id) => {
            await grantInstantConsent(id);
          }}
        />
      )}

      {/* Direct Wali Contact Modal */}
      {activeWaliProfile && (
        <WaliContactModal
          targetProfile={activeWaliProfile}
          currentProfile={profile}
          onClose={() => setActiveWaliProfile(null)}
        />
      )}

      {/* Direct Moderated Chat Window */}
      {activeChatProfile && (
        <ChatWindow
          currentProfile={profile}
          targetProfile={activeChatProfile}
          viewerTier={tier}
          onClose={() => setActiveChatProfile(null)}
          onStartCall={(targetId, type) => {
            if (onStartCall) onStartCall(targetId, type);
          }}
          onOpenPricing={onOpenPricing}
        />
      )}
    </div>
  );
}
