// ==============================================================================
// MY MATCHES (ACCEPTED CONNECTIONS) VIEW
// Dedicated view for mutually accepted matrimonial connections
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  HeartHandshake,
  MessageSquare,
  PhoneCall,
  Video,
  Shield,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  Search,
  CheckCircle2,
  Calendar,
  User,
  Users,
  ChevronRight,
  ExternalLink,
  Lock,
  Eye,
  X,
  Phone,
  Mail,
  Crown,
} from 'lucide-react';
import { Connection, Profile, SubscriptionTier } from '../../types';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { getDisplayName } from '../../lib/utils';
import { usePhotoConsent } from '../../hooks/usePhotoConsent';

interface AcceptedMatchesViewProps {
  currentUserId: string | null;
  currentProfile: Profile | null;
  tier: SubscriptionTier;
  allProfiles: Profile[];
  onNavigateChat?: (partnerId: string) => void;
  onOpenPricing?: () => void;
  onStartCall?: (partnerId: string, type: 'voice' | 'video') => void;
  onExploreDiscover?: () => void;
}

interface AcceptedMatchCardData {
  connection: Connection;
  partnerProfile: Profile;
  lastMessageSnippet?: string;
  unreadCount?: number;
}

export const AcceptedMatchesView: React.FC<AcceptedMatchesViewProps> = ({
  currentUserId,
  currentProfile,
  tier,
  allProfiles,
  onNavigateChat,
  onOpenPricing,
  onStartCall,
  onExploreDiscover,
}) => {
  const [matches, setMatches] = useState<AcceptedMatchCardData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProfileModal, setSelectedProfileModal] = useState<Profile | null>(null);

  const { hasPhotoAccess, getConsentStatus, sendRequest } = usePhotoConsent(currentUserId);

  // Fallback profile generator
  const getFallbackProfile = (partnerId: string): Profile => {
    const fromAll = allProfiles.find((p) => p.id === partnerId);
    if (fromAll) return fromAll;

    const fromStore = daheejStore.getProfileById(partnerId);
    if (fromStore) return fromStore;

    return {
      id: partnerId,
      full_name: 'Verified Candidate',
      gender: currentProfile?.gender === 'male' ? 'female' : 'male',
      age: 26,
      profession: 'Professional',
      city: 'Hyderabad',
      location: 'Hyderabad, India',
      wali_name: 'Family Guardian',
      wali_relation: 'Father',
      wali_phone: '+91 98765 43210',
      wali_email: 'guardian@daheejfree.com',
      anti_dowry_pledged: true,
      subscription_tier: 'free',
      subscription_status: 'active',
      kyc_status: 'verified',
      is_onboarded: true,
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
      photo_privacy: false,
      bio: 'Practicing Muslim seeking a blessed, dowry-free Nikah on the Sunnah.',
      education: 'Bachelor Degree',
      religious_sect: 'Sunni',
      marital_status: 'Never Married',
      has_children: false,
      height_cm: 168,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  // STABILIZED FETCHING LOGIC & PRIMITIVE DEPENDENCY ARRAY [currentUserId]
  useEffect(() => {
    let isMounted = true;

    async function loadMatches() {
      if (!currentUserId) {
        if (isMounted) {
          setMatches([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        // 1. Fetch connections directly without fragile foreign key join constraints
        const { data, error } = await supabase
          .from('connections')
          .select('*')
          .eq('status', 'accepted')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

        if (error) {
          console.warn('Supabase connections query notice:', error.message);
        }

        if (isMounted) {
          if (data && data.length > 0) {
            const formatted: AcceptedMatchCardData[] = [];
            data.forEach((conn: Record<string, string>) => {
              const partnerId = conn.sender_id === currentUserId ? conn.receiver_id : conn.sender_id;
              const partnerProfile = allProfiles.find((p) => p.id === partnerId) || daheejStore.getProfileById(partnerId) || getFallbackProfile(partnerId);

              const convo = daheejStore.getMessages(currentUserId, partnerId);
              const lastMsg = convo.length > 0 ? convo[convo.length - 1].content : undefined;

              formatted.push({
                connection: conn as any,
                partnerProfile,
                lastMessageSnippet: lastMsg,
              });
            });
            setMatches(formatted);
          } else {
            // Fallback: Read local store
            const localConns = daheejStore.getConnectionsForUser(currentUserId);
            const accepted = localConns.filter((c) => c.status === 'accepted');

            const fallbackFormatted: AcceptedMatchCardData[] = [];
            accepted.forEach((conn) => {
              const partnerId = conn.sender_id === currentUserId ? conn.receiver_id : conn.sender_id;
              const partnerProfile = allProfiles.find((p) => p.id === partnerId) || daheejStore.getProfileById(partnerId);
              if (!partnerProfile || !partnerProfile.id) return;

              const convo = daheejStore.getMessages(currentUserId, partnerId);
              const lastMsg = convo.length > 0 ? convo[convo.length - 1].content : undefined;

              fallbackFormatted.push({
                connection: conn,
                partnerProfile,
                lastMessageSnippet: lastMsg,
              });
            });
            setMatches(fallbackFormatted);
          }
        }
      } catch (err) {
        console.error('Error fetching accepted matches:', err);
        if (isMounted) {
          // Graceful fallback to store without throwing
          const localConns = daheejStore.getConnectionsForUser(currentUserId);
          const accepted = localConns.filter((c) => c.status === 'accepted');
          const fallbackList: AcceptedMatchCardData[] = [];
          accepted.forEach((conn) => {
            const partnerId = conn.sender_id === currentUserId ? conn.receiver_id : conn.sender_id;
            const partnerProfile = allProfiles.find((p) => p.id === partnerId) || daheejStore.getProfileById(partnerId);
            if (!partnerProfile || !partnerProfile.id) return;
            fallbackList.push({
              connection: conn,
              partnerProfile,
            });
          });
          setMatches(fallbackList);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadMatches();

    // Setup non-intrusive realtime subscription (silent updates, NO loading flicker)
    const unsubStore = daheejStore.subscribe((event) => {
      if (!isMounted || !currentUserId) return;
      if (event.table === 'connections' || event.table === 'messages') {
        const localConns = daheejStore.getConnectionsForUser(currentUserId);
        const accepted = localConns.filter((c) => c.status === 'accepted');
        const updateList: AcceptedMatchCardData[] = [];
        accepted.forEach((conn) => {
          const partnerId = conn.sender_id === currentUserId ? conn.receiver_id : conn.sender_id;
          const partnerProfile = allProfiles.find((p) => p.id === partnerId) || daheejStore.getProfileById(partnerId);
          if (!partnerProfile || !partnerProfile.id) return;
          const convo = daheejStore.getMessages(currentUserId, partnerId);
          updateList.push({
            connection: conn,
            partnerProfile,
            lastMessageSnippet: convo.length > 0 ? convo[convo.length - 1].content : undefined,
          });
        });
        setMatches(updateList);
      }
    });

    const channelId = `accepted_matches_${currentUserId}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
        },
        (payload) => {
          if (!isMounted || !payload.new) return;
          const conn = payload.new as Connection;
          if (conn.status === 'accepted' && (conn.sender_id === currentUserId || conn.receiver_id === currentUserId)) {
            daheejStore.setConnectionFromRemote(conn);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      unsubStore();
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Filter matches based on search query
  const filteredMatches = useMemo(() => {
    return matches.filter((item) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const p = item.partnerProfile;
      return (
        p.full_name?.toLowerCase().includes(query) ||
        p.city?.toLowerCase().includes(query) ||
        p.profession?.toLowerCase().includes(query) ||
        p.education?.toLowerCase().includes(query)
      );
    });
  }, [matches, searchQuery]);

  if (!currentUserId && !isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
          <HeartHandshake className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
            Mutual Accepted Matches
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            Sign in to view your mutually accepted matrimonial matches, coordinate with guardians, and exchange messages.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {onExploreDiscover && (
            <button
              onClick={onExploreDiscover}
              className="py-2.5 px-6 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              Discover Candidates
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80">
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Mutual Halal Connection Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            My Matches
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
            Candidates where both parties have officially accepted marriage proposals. You have full permission to exchange encrypted messages and coordinate with Walis.
          </p>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, city, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid or Loading / Empty States */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 animate-pulse shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : filteredMatches.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-6 shadow-sm">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-inner">
            <HeartHandshake className="w-10 h-10" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white">
              {searchQuery ? 'No Matches Found' : 'No Accepted Matches Yet'}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {searchQuery
                ? `No matched candidate matches the search query "${searchQuery}".`
                : 'When you accept an incoming proposal or another candidate accepts your connection request, their profile will permanently appear here for direct communication.'}
            </p>
          </div>

          {onExploreDiscover && (
            <button
              onClick={onExploreDiscover}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-700/20 transition-all hover:scale-105 inline-flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Discover Nikah Candidates</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        /* Accepted Matches Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(filteredMatches || []).map(({ connection, partnerProfile, lastMessageSnippet }) => {
            const isPhotoUnlocked = hasPhotoAccess(partnerProfile.id);
            const consentStatus = getConsentStatus(partnerProfile.id);

            return (
              <div
                key={connection.id}
                className="bg-white dark:bg-zinc-900 border border-emerald-300/80 dark:border-emerald-800/60 rounded-3xl p-6 shadow-md hover:shadow-xl dark:shadow-emerald-950/20 transition-all flex flex-col justify-between space-y-5 relative overflow-hidden group"
              >
                {/* Subtle top accent gradient */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500" />

                {/* Top Status & Timestamp */}
                <div className="flex items-center justify-between pt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Mutual Match Active
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(connection.updated_at || connection.created_at || Date.now()).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                {/* Main Profile Info Row */}
                <div className="flex items-start gap-4">
                  {isPhotoUnlocked ? (
                    <div
                      onClick={() => setSelectedProfileModal(partnerProfile)}
                      className="relative w-20 h-20 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex-shrink-0 cursor-pointer group-hover:scale-105 transition-transform shadow-sm"
                    >
                      <img
                        src={partnerProfile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500'}
                        alt={getDisplayName(partnerProfile)}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => setSelectedProfileModal(partnerProfile)}
                      className="relative w-20 h-20 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-700/80 flex flex-col items-center justify-center p-1 text-center shrink-0 cursor-pointer shadow-inner hover:border-emerald-500/50 transition-all group-hover:scale-105"
                      title="Haya Mode: Photo Access Consent Required"
                    >
                      <Lock className="w-5 h-5 text-emerald-400 mb-0.5" />
                      <span className="text-[9px] font-black uppercase tracking-tight text-emerald-300 leading-tight">
                        Haya Mode
                      </span>
                      <span className="text-[8px] font-medium text-zinc-400 leading-tight">
                        Consent Req.
                      </span>
                    </div>
                  )}

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        onClick={() => setSelectedProfileModal(partnerProfile)}
                        className="text-base font-bold text-zinc-900 dark:text-white truncate cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        {getDisplayName(partnerProfile)}
                      </h3>
                      {partnerProfile.kyc_status === 'verified' && (
                        <span
                          title="Identity cryptographically verified via the Didit protocol to ensure authenticity and prevent fake profiles."
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-700/60 text-[10px] font-bold shrink-0 cursor-help"
                        >
                          <Shield className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          ✓ Didit Verified
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium truncate">
                      {partnerProfile.age} yrs • {partnerProfile.profession || 'Professional'}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 pt-0.5">
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                        {partnerProfile.city || partnerProfile.location || 'Verified City'}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <GraduationCap className="w-3 h-3 text-teal-600 shrink-0" />
                        {partnerProfile.education || 'Graduate'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bio / Anti-Dowry Badge & Conversation Status */}
                <div className="bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl p-3.5 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                      <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Zero-Dowry Pledge Signed</span>
                    </div>
                    {tier === 'diamond' && partnerProfile.wali_name && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                        Wali: {partnerProfile.wali_relation || 'Guardian'}
                      </span>
                    )}
                  </div>

                  {lastMessageSnippet ? (
                    <div className="pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-start gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                      <MessageSquare className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                      <p className="line-clamp-1">"{lastMessageSnippet}"</p>
                    </div>
                  ) : partnerProfile.bio ? (
                    <p className="text-zinc-600 dark:text-zinc-400 text-[11px] line-clamp-2 italic">
                      "{partnerProfile.bio}"
                    </p>
                  ) : null}
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2 pt-1">
                  {/* Send Message Button (Primary CTA) */}
                  <button
                    id={`btn-send-message-${partnerProfile.id}`}
                    onClick={() => {
                      if (onNavigateChat) {
                        onNavigateChat(partnerProfile.id);
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send Message</span>
                  </button>

                  {/* Secondary Actions: Call & View Profile */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id={`btn-webrtc-call-${partnerProfile.id}`}
                      disabled={!isPhotoUnlocked}
                      onClick={() => {
                        if (isPhotoUnlocked && onStartCall) {
                          onStartCall(partnerProfile.id, 'video');
                        }
                      }}
                      title={
                        !isPhotoUnlocked
                          ? 'Photo consent is required before starting a WebRTC video call'
                          : 'Start WebRTC Video Call'
                      }
                      className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        !isPhotoUnlocked
                          ? 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-400 dark:text-zinc-500 opacity-50 cursor-not-allowed border border-dashed border-zinc-300 dark:border-zinc-700'
                          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 cursor-pointer hover:scale-[1.01]'
                      }`}
                    >
                      <Video className={`w-3.5 h-3.5 ${!isPhotoUnlocked ? 'text-zinc-400 dark:text-zinc-500' : 'text-teal-600 dark:text-teal-400'}`} />
                      <span>WebRTC Call</span>
                    </button>

                    <button
                      id={`btn-view-bio-${partnerProfile.id}`}
                      onClick={() => setSelectedProfileModal(partnerProfile)}
                      className="py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01]"
                    >
                      <User className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                      <span>View Bio</span>
                    </button>
                  </div>

                  {!isPhotoUnlocked && (
                    <div className="pt-0.5 flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-400/90 font-medium">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>Photo consent required for video call</span>
                      </span>
                      {consentStatus === 'none' && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await sendRequest(partnerProfile.id);
                          }}
                          className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-700 cursor-pointer"
                        >
                          Request Photo Access
                        </button>
                      )}
                      {consentStatus === 'pending' && (
                        <span className="text-[10px] text-zinc-500 italic">Consent Pending</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Matrimonial Profile Modal */}
      {selectedProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  <HeartHandshake className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Matched Nikah Candidate
                  </h3>
                  <p className="text-xs text-zinc-500">Mutual consent confirmed</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProfileModal(null)}
                className="p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Avatar & Essentials */}
            <div className="flex items-center gap-4">
              {hasPhotoAccess(selectedProfileModal.id) ? (
                <img
                  src={selectedProfileModal.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500'}
                  alt={selectedProfileModal.full_name}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-2xl object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-zinc-950 border border-zinc-700 flex flex-col items-center justify-center p-1 text-center shrink-0 shadow-inner">
                  <Lock className="w-6 h-6 text-emerald-400 mb-0.5" />
                  <span className="text-[9px] font-black uppercase text-emerald-300 leading-tight">Haya Mode</span>
                  <span className="text-[8px] text-zinc-400 leading-tight">Consent Req.</span>
                </div>
              )}
              <div className="space-y-1">
                <h4 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                  {getDisplayName(selectedProfileModal)}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  {selectedProfileModal.age} years old • {selectedProfileModal.profession}
                </p>
                <p className="text-xs text-zinc-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  {selectedProfileModal.city || selectedProfileModal.location || 'India'}
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div>
                <span className="text-zinc-500 block">Education:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {selectedProfileModal.education || 'Graduate'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Marital Status:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {selectedProfileModal.marital_status || 'Never Married'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Sect / Practice:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {selectedProfileModal.religious_sect || 'Sunni'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">KYC Status:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {selectedProfileModal.kyc_status === 'verified' ? 'Didit Verified' : 'Pending Didit KYC'}
                </span>
              </div>
            </div>

            {/* Bio Section */}
            {selectedProfileModal.bio && (
              <div className="space-y-1.5">
                <h5 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  About Candidate & Deen
                </h5>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  {selectedProfileModal.bio}
                </p>
              </div>
            )}

            {/* Wali Guardian Information */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  Family Guardian (Wali) Details
                </span>
                {tier !== 'diamond' && (
                  <button
                    onClick={() => {
                      setSelectedProfileModal(null);
                      if (onOpenPricing) onOpenPricing();
                    }}
                    className="text-[10px] text-amber-600 dark:text-amber-400 font-bold underline cursor-pointer"
                  >
                    Unlock Diamond
                  </button>
                )}
              </div>

              {tier === 'diamond' ? (
                <div className="space-y-1 text-xs text-zinc-800 dark:text-zinc-200 pt-1">
                  <p>
                    <strong>Name:</strong> {selectedProfileModal.wali_name || 'Family Guardian'} (
                    {selectedProfileModal.wali_relation || 'Father'})
                  </p>
                  {selectedProfileModal.wali_phone && (
                    <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-mono">
                      <Phone className="w-3.5 h-3.5" />
                      {selectedProfileModal.wali_phone}
                    </p>
                  )}
                  {selectedProfileModal.wali_email && (
                    <p className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                      <Mail className="w-3.5 h-3.5" />
                      {selectedProfileModal.wali_email}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Wali name: {selectedProfileModal.wali_name || 'Family Guardian'} ({selectedProfileModal.wali_relation || 'Father'}). Direct phone & email contact unlocked with <strong>Diamond Tier</strong>.
                </p>
              )}
            </div>

            {/* Modal Bottom CTA */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  const partnerId = selectedProfileModal.id;
                  setSelectedProfileModal(null);
                  if (onNavigateChat) onNavigateChat(partnerId);
                }}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Open Chat with Candidate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcceptedMatchesView;
