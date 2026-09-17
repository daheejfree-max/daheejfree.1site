'use client';

// ==============================================================================
// MATCH PROPOSALS & REQUESTS INBOX (src/app/requests/page.tsx)
// Resilient Supabase sync, safe null-guards, instant optimistic removal & UI feedback
// ==============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Inbox,
  Send,
  CheckCircle2,
  Clock,
  MapPin,
  GraduationCap,
  Shield,
  Heart,
  UserCheck,
  UserX,
  MessageSquare,
  Search,
  Lock,
  Unlock,
  Eye,
  Check,
  X,
  Users,
  Sparkles,
  LogIn,
} from 'lucide-react';
import { Connection, Profile, SubscriptionTier } from '../../types';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { useRouter } from '../../hooks/useRouter';
import { useAuth } from '../../hooks/useAuth';
import { usePhotoConsent } from '../../hooks/usePhotoConsent';
import { WatermarkedImage } from '../../components/privacy/WatermarkedImage';
import { getDisplayName } from '../../lib/utils';
import AcceptedMatchesView from '../../components/matches/AcceptedMatchesView';

interface EnrichedRequest {
  connection: Connection;
  senderProfile: Profile;
}

interface RequestsPageProps {
  currentUserId?: string | null;
  currentProfile?: Profile | null;
  tier?: SubscriptionTier;
  allProfiles?: Profile[];
  onNavigateChat?: (partnerId: string) => void;
  onOpenPricing?: () => void;
  onStartCall?: (partnerId: string, type: 'voice' | 'video') => void;
  onExploreDiscover?: () => void;
}

export default function RequestsPage({
  currentUserId: propUserId,
  currentProfile: propProfile,
  tier: propTier,
  allProfiles: propAllProfiles,
  onNavigateChat,
  onOpenPricing,
  onStartCall,
  onExploreDiscover,
}: RequestsPageProps) {
  const router = useRouter();
  const auth = useAuth();
  const currentProfile = propProfile !== undefined ? propProfile : auth.profile;
  const currentUserId = propUserId !== undefined ? propUserId : (currentProfile?.id || auth.profile?.id || null);
  const tier = propTier !== undefined ? propTier : auth.tier;
  const allProfiles = propAllProfiles !== undefined ? propAllProfiles : auth.allProfiles;

  const [activeSubTab, setActiveSubTab] = useState<'incoming' | 'sent' | 'accepted' | 'photo_requests'>('incoming');
  const {
    inboundRequests,
    outboundRequests,
    acceptRequest: acceptPhotoConsentHook,
    rejectRequest: rejectPhotoConsentHook,
    hasPhotoAccess,
  } = usePhotoConsent(currentUserId);
  const [requests, setRequests] = useState<EnrichedRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<EnrichedRequest[]>([]);
  const [acceptedMatches, setAcceptedMatches] = useState<EnrichedRequest[]>([]);
  const [photoRequestsList, setPhotoRequestsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Explicit Inbound Photo Requests Fetcher with Foreign Key Resolution
  const fetchInboundPhotoRequests = useCallback(async () => {
    if (!currentUserId) {
      setPhotoRequestsList([]);
      return;
    }
    try {
      const { data: requests, error: reqErr } = await supabase
        .from('photo_permissions')
        .select('id, requestor_id, target_id, status, created_at')
        .eq('target_id', currentUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (reqErr || !requests || requests.length === 0) {
        setPhotoRequestsList([]);
        return;
      }

      const requestorIds = requests.map((r) => r.requestor_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city, profession, age, gender, kyc_status, location')
        .in('id', requestorIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const enriched = requests.map((req) => ({
        ...req,
        profiles: profileMap.get(req.requestor_id) || null,
      }));
      setPhotoRequestsList(enriched);
    } catch (err) {
      console.warn('[RequestsPage] fetchInboundPhotoRequests notice:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchInboundPhotoRequests();

    // Supabase Realtime Listener on photo_permissions
    const channelId = `inbound_photo_perm_${currentUserId}_${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photo_permissions',
          filter: `target_id=eq.${currentUserId}`,
        },
        () => {
          fetchInboundPhotoRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchInboundPhotoRequests]);

  // Handle Photo Request Approval with instant state update
  const handleApprovePhotoRequest = async (requestId: string, requestorId?: string) => {
    // Optimistic UI state removal
    setPhotoRequestsList((prev) => prev.filter((r) => r.id !== requestId));
    
    // Call hook for store update
    await acceptPhotoConsentHook(requestId, requestorId);

    try {
      await supabase
        .from('photo_permissions')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', requestId);
    } catch (e) {
      console.error('[RequestsPage] Approve photo request error:', e);
    }
  };

  // Handle Photo Request Rejection with instant state update
  const handleRejectPhotoRequest = async (requestId: string, requestorId?: string) => {
    // Optimistic UI state removal
    setPhotoRequestsList((prev) => prev.filter((r) => r.id !== requestId));
    
    // Call hook for store update
    await rejectPhotoConsentHook(requestId, requestorId);

    try {
      await supabase
        .from('photo_permissions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', requestId);
    } catch (e) {
      console.error('[RequestsPage] Reject photo request error:', e);
    }
  };

  // Safe fallback profile lookup
  const getProfileById = (partnerId: string): Profile => {
    if (!partnerId) {
      return {
        id: 'unknown',
        full_name: 'Nikah Candidate',
        gender: 'female',
        age: 25,
        profession: 'Professional',
        location: 'Verified Member',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
        wali_name: 'Guardian',
        wali_email: null,
        anti_dowry_pledged: true,
        kyc_status: 'verified',
        subscription_tier: 'free',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const fromAll = allProfiles?.find((p) => p.id === partnerId);
    if (fromAll && fromAll.id) return fromAll;

    const fromStore = daheejStore.getProfileById(partnerId);
    if (fromStore && fromStore.id) return fromStore;

    return {
      id: partnerId,
      full_name: 'Nikah Candidate',
      gender: 'female',
      age: 25,
      profession: 'Member',
      location: 'India',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
      wali_name: 'Guardian',
      wali_email: null,
      anti_dowry_pledged: true,
      kyc_status: 'verified',
      subscription_tier: 'free',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  // 1. ROBUST FETCHING WITH DUAL-PHASE SUPABASE & LOCAL SYNC
  useEffect(() => {
    let isMounted = true;

    async function loadConnections() {
      if (!currentUserId) {
        if (isMounted) {
          setRequests([]);
          setSentRequests([]);
          setAcceptedMatches([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        // Query connections directly without strict inner join assumptions
        const { data: rawConns, error: connErr } = await supabase
          .from('connections')
          .select('*')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

        if (!connErr && rawConns && rawConns.length > 0) {
          const incList: EnrichedRequest[] = [];
          const accList: EnrichedRequest[] = [];
          const sntList: EnrichedRequest[] = [];

          // Collect missing partner IDs to fetch from profiles table
          const partnerIds = new Set<string>();
          rawConns.forEach((c) => {
            const otherId = c.sender_id === currentUserId ? c.receiver_id : c.sender_id;
            if (otherId) partnerIds.add(otherId);
            daheejStore.setConnectionFromRemote(c);
          });

          inboundRequests.forEach((r) => {
            if (r.requester_id) partnerIds.add(r.requester_id);
          });
          outboundRequests.forEach((r) => {
            const tgt = r.target_user_id || r.target_id;
            if (tgt) partnerIds.add(tgt);
          });

          // Fetch profiles for these partners
          const { data: dbProfiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', Array.from(partnerIds));

          const profileMap = new Map<string, Profile>();
          if (dbProfiles) {
            dbProfiles.forEach((p: Profile) => {
              if (p?.id) {
                profileMap.set(p.id, p);
                daheejStore.updateProfile(p.id, p);
              }
            });
          }

          rawConns.forEach((conn) => {
            if (conn.receiver_id === currentUserId && conn.status === 'pending') {
              const prof = profileMap.get(conn.sender_id) || getProfileById(conn.sender_id);
              incList.push({ connection: conn, senderProfile: prof });
            } else if (conn.sender_id === currentUserId && conn.status === 'pending') {
              const prof = profileMap.get(conn.receiver_id) || getProfileById(conn.receiver_id);
              sntList.push({ connection: conn, senderProfile: prof });
            } else if (conn.status === 'accepted') {
              const partnerId = conn.sender_id === currentUserId ? conn.receiver_id : conn.sender_id;
              const prof = profileMap.get(partnerId) || getProfileById(partnerId);
              accList.push({ connection: conn, senderProfile: prof });
            }
          });

          if (isMounted) {
            setRequests(incList);
            setSentRequests(sntList);
            setAcceptedMatches(accList);
          }
        } else {
          // Local store fallback
          const allUserConns = daheejStore.getConnectionsForUser(currentUserId);

          const incoming = allUserConns
            .filter((c) => c.receiver_id === currentUserId && c.status === 'pending')
            .map((c) => ({
              connection: c,
              senderProfile: getProfileById(c.sender_id),
            }));

          const sent = allUserConns
            .filter((c) => c.sender_id === currentUserId && c.status === 'pending')
            .map((c) => ({
              connection: c,
              senderProfile: getProfileById(c.receiver_id),
            }));

          const accepted = allUserConns
            .filter((c) => c.status === 'accepted')
            .map((c) => {
              const partnerId = c.sender_id === currentUserId ? c.receiver_id : c.sender_id;
              return {
                connection: c,
                senderProfile: getProfileById(partnerId),
              };
            });

          if (isMounted) {
            setRequests(incoming);
            setSentRequests(sent);
            setAcceptedMatches(accepted);
          }
        }
      } catch (err) {
        console.warn('[RequestsPage] Connections load notice:', err);
        // Resilient fallback to local store
        if (isMounted) {
          const allUserConns = daheejStore.getConnectionsForUser(currentUserId);
          setRequests(
            allUserConns
              .filter((c) => c.receiver_id === currentUserId && c.status === 'pending')
              .map((c) => ({ connection: c, senderProfile: getProfileById(c.sender_id) }))
          );
          setSentRequests(
            allUserConns
              .filter((c) => c.sender_id === currentUserId && c.status === 'pending')
              .map((c) => ({ connection: c, senderProfile: getProfileById(c.receiver_id) }))
          );
          setAcceptedMatches(
            allUserConns
              .filter((c) => c.status === 'accepted')
              .map((c) => ({
                connection: c,
                senderProfile: getProfileById(c.sender_id === currentUserId ? c.receiver_id : c.sender_id),
              }))
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadConnections();

    // Silent subscription updates from store
    const unsubStore = daheejStore.subscribe((e) => {
      if (!isMounted || !currentUserId) return;
      if (e.table === 'connections') {
        const allUserConns = daheejStore.getConnectionsForUser(currentUserId);
        setRequests(
          allUserConns
            .filter((c) => c.receiver_id === currentUserId && c.status === 'pending')
            .map((c) => ({
              connection: c,
              senderProfile: getProfileById(c.sender_id),
            }))
        );
        setSentRequests(
          allUserConns
            .filter((c) => c.sender_id === currentUserId && c.status === 'pending')
            .map((c) => ({
              connection: c,
              senderProfile: getProfileById(c.receiver_id),
            }))
        );
        setAcceptedMatches(
          allUserConns
            .filter((c) => c.status === 'accepted')
            .map((c) => ({
              connection: c,
              senderProfile: getProfileById(c.sender_id === currentUserId ? c.receiver_id : c.sender_id),
            }))
        );
      }
    });

    const channelId = `match_requests_page_${currentUserId}_${Math.random().toString(36).slice(2, 9)}`;
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
          if (conn.receiver_id === currentUserId || conn.sender_id === currentUserId) {
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

  // 2. INSTANT OPTIMISTIC ACCEPT HANDLER
  const handleAccept = async (connectionId: string, receiverId: string) => {
    if (!currentUserId) return;

    // A. Instant UI update
    setRequests((prev) => prev.filter((r) => r.connection.id !== connectionId));

    // B. Decrement pending requests count & update local store
    daheejStore.respondToConnection(connectionId, 'accepted');
    daheejStore.respondToConnectionByUsers(currentUserId, receiverId, 'accepted');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('daheej:request_handled', { detail: { connectionId, status: 'accepted' } }));
    }

    // C. Initialize warm Islamic welcome greeting
    daheejStore.sendMessage(
      currentUserId,
      receiverId,
      'Assalamu Alaikum! I have accepted your match proposal. Looking forward to discussing with our family Walis.'
    );

    try {
      await supabase
        .from('connections')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .or(`id.eq.${connectionId},and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUserId})`);

      if (onNavigateChat) {
        onNavigateChat(receiverId);
      } else {
        router.push(`/messages?chat=${receiverId}`);
      }
    } catch (err) {
      console.error('Accept match error:', err);
      if (onNavigateChat) {
        onNavigateChat(receiverId);
      } else {
        router.push(`/messages?chat=${receiverId}`);
      }
    }
  };

  // 3. INSTANT OPTIMISTIC DECLINE HANDLER
  const handleDecline = async (connectionId: string, senderId?: string) => {
    if (!currentUserId) return;

    setRequests((prev) => prev.filter((r) => r.connection.id !== connectionId));
    daheejStore.respondToConnection(connectionId, 'rejected');
    if (senderId) {
      daheejStore.respondToConnectionByUsers(currentUserId, senderId, 'rejected');
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('daheej:request_handled', { detail: { connectionId, status: 'rejected' } }));
    }

    try {
      await supabase
        .from('connections')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId);
    } catch (err) {
      console.error('Decline match error:', err);
    }
  };

  // Filter lists safely
  const filterList = (list: EnrichedRequest[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (r) =>
        r.senderProfile?.full_name?.toLowerCase().includes(q) ||
        r.senderProfile?.location?.toLowerCase().includes(q) ||
        r.senderProfile?.profession?.toLowerCase().includes(q)
    );
  };

  const filteredRequests = useMemo(() => filterList(requests), [requests, searchQuery]);
  const filteredSent = useMemo(() => filterList(sentRequests), [sentRequests, searchQuery]);
  const filteredAccepted = useMemo(() => filterList(acceptedMatches), [acceptedMatches, searchQuery]);

  // If unauthenticated state
  if (!currentUserId && !isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
          <Shield className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
            Match Proposals & Requests
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            Sign in or create your verified anti-dowry matrimonial profile to view incoming proposals and exchange photo access permissions.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            onClick={() => router.push('/login')}
            className="py-2.5 px-6 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Sign In to Account
          </button>
          <button
            onClick={() => router.push('/matches')}
            className="py-2.5 px-6 rounded-xl text-xs sm:text-sm font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors flex items-center gap-2 cursor-pointer border border-zinc-200 dark:border-zinc-700"
          >
            <Users className="w-4 h-4" />
            Explore Candidates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Islamic Anti-Dowry Matrimonial Inbox</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            Match Requests & Proposals
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
            Review incoming halal marriage proposals, track sent requests, and view mutual matches.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-3">
          <button
            onClick={() => setActiveSubTab('incoming')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'incoming'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Incoming Proposals
            {requests.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                {requests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('sent')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'sent'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Send className="w-4 h-4" />
            Sent Requests ({sentRequests.length})
          </button>

          <button
            onClick={() => setActiveSubTab('accepted')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'accepted'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Mutual Matches ({acceptedMatches.length})
          </button>

          <button
            onClick={() => setActiveSubTab('photo_requests')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'photo_requests'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" />
            Photo Access Requests
            {(photoRequestsList.length > 0 || inboundRequests.filter((r) => r.status === 'pending').length > 0) && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                {photoRequestsList.length || inboundRequests.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content View */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                <div className="space-y-2 flex-1">
                  <div className="w-3/4 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="w-1/2 h-3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              </div>
              <div className="w-full h-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : activeSubTab === 'incoming' ? (
        /* ================= INCOMING REQUESTS ================= */
        filteredRequests.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <Inbox className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {searchQuery ? 'No Matching Proposals' : 'No Incoming Proposals'}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                {searchQuery
                  ? `No proposals match "${searchQuery}".`
                  : 'When other Nikah candidates express interest in your profile, their requests will appear here for your review.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(filteredRequests || []).map((req) => {
              const profile = req.senderProfile || getProfileById(req.connection.sender_id);
              const senderId = req.connection.sender_id;

              return (
                <div
                  key={req.connection.id}
                  className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/60 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative"
                >
                  {/* Top Status & Date */}
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      <Heart className="w-3.5 h-3.5 fill-current text-rose-500" />
                      Incoming Nikah Proposal
                    </span>
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(req.connection.created_at || Date.now()).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Profile Info */}
                  <div className="flex items-start gap-4">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                      <WatermarkedImage
                        src={profile.avatar_url}
                        alt={getDisplayName(profile)}
                        fallbackInitial={getDisplayName(profile)?.charAt(0)?.toUpperCase()}
                        viewerId={currentUserId || ''}
                        isUnlocked={hasPhotoAccess(profile.id)}
                        blurMessage={profile.photo_privacy ? 'Haya Mode: Blurred' : 'Private Photo'}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">
                          {getDisplayName(profile)}
                        </h3>
                        {profile.kyc_status === 'verified' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                            <Shield className="w-3 h-3" />
                            KYC
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                        {profile.age || 25} yrs • {profile.profession || 'Professional'}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 pt-0.5">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-emerald-600" />
                          {profile.location || 'India'}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <GraduationCap className="w-3 h-3 text-teal-600" />
                          {profile.education || 'Graduate'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Anti-Dowry Badge & Bio */}
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl p-3 border border-emerald-100 dark:border-emerald-900/40 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Solemn Islamic Anti-Dowry Pledge Signed</span>
                    </div>
                    {profile.bio && (
                      <p className="text-zinc-600 dark:text-zinc-300 text-[11px] line-clamp-2 italic">
                        "{profile.bio}"
                      </p>
                    )}
                  </div>

                  {/* Action Buttons: Instant Optimistic Handlers */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      id={`btn-decline-match-${req.connection.id}`}
                      onClick={() => handleDecline(req.connection.id, senderId)}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-zinc-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-300 border border-zinc-200 dark:border-zinc-700 hover:border-rose-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserX className="w-4 h-4" />
                      Decline
                    </button>

                    <button
                      id={`btn-accept-match-${req.connection.id}`}
                      onClick={() => handleAccept(req.connection.id, senderId)}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      Accept Match
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeSubTab === 'sent' ? (
        /* ================= SENT REQUESTS ================= */
        filteredSent.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto text-zinc-500">
              <Send className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                No Outgoing Requests
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Explore verified Nikah candidate profiles and send connection requests to start a halal conversation.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(filteredSent || []).map((req) => {
              const profile = req.senderProfile || getProfileById(req.connection.receiver_id);

              return (
                <div
                  key={req.connection.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      <Send className="w-3.5 h-3.5 text-zinc-500" />
                      Outgoing Proposal Sent
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Status: <strong className="capitalize text-zinc-700 dark:text-zinc-300">{req.connection.status}</strong>
                    </span>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                      <WatermarkedImage
                        src={profile.avatar_url}
                        alt={getDisplayName(profile)}
                        fallbackInitial={getDisplayName(profile)?.charAt(0)?.toUpperCase()}
                        viewerId={currentUserId || ''}
                        isUnlocked={hasPhotoAccess(profile.id)}
                        blurMessage={profile.photo_privacy ? 'Haya Mode' : 'Private Photo'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-1 flex-1">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                        {getDisplayName(profile)}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {profile.age || 25} yrs • {profile.profession || 'Professional'}
                      </p>
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        {profile.location || 'India'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeSubTab === 'accepted' ? (
        /* ================= ACCEPTED MATCHES (CONSOLIDATED UNIFIED VIEW) ================= */
        <AcceptedMatchesView
          currentUserId={currentUserId}
          currentProfile={currentProfile}
          tier={tier}
          allProfiles={allProfiles}
          onNavigateChat={onNavigateChat}
          onOpenPricing={onOpenPricing}
          onStartCall={onStartCall}
          onExploreDiscover={onExploreDiscover}
        />
      ) : (
        /* ================= PHOTO ACCESS REQUESTS ================= */
        <div className="space-y-6">
          {/* Informational banner */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-5 sm:p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 dark:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Strict Exclusive Photo Privacy Rules
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Being a "Match" does not grant photo access. Photos are only unlocked when both parties exchange and approve an explicit Photo Access Request in accordance with Islamic modesty principles.
              </p>
            </div>
          </div>

          {/* Inbound Photo Requests */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-zinc-900 dark:text-white text-base">
                  Inbound Photo Requests ({photoRequestsList.length > 0 ? photoRequestsList.length : inboundRequests.length})
                </h3>
              </div>
              <span className="text-xs text-zinc-500">Candidates requesting to view your photo</span>
            </div>

            {(photoRequestsList.length === 0 && inboundRequests.length === 0) ? (
              <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800/80">
                <Shield className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">No incoming photo requests at this time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {((photoRequestsList.length > 0 ? photoRequestsList : inboundRequests) || []).map((req: any) => {
                  const reqId = req.requestor_id || req.requester_id;
                  const profileData = req.profiles || req.requester || getProfileById(reqId);
                  const reqName = profileData?.full_name || (profileData ? getDisplayName(profileData) : 'Nikah Candidate');

                  return (
                    <div
                      key={req.id}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-700 dark:text-zinc-300 text-sm overflow-hidden">
                          {(req.status === 'accepted' || req.status === 'approved') && profileData?.avatar_url ? (
                            <img
                              src={profileData.avatar_url}
                              alt={reqName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Lock className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                            {reqName}
                          </h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {profileData?.age ? `${profileData.age} yrs • ` : ''}{profileData?.profession || 'Professional'} • {profileData?.location || profileData?.city || 'India'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {req.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleRejectPhotoRequest(req.id, reqId)}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              Decline
                            </button>
                            <button
                              onClick={() => handleApprovePhotoRequest(req.id, reqId)}
                              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md shadow-emerald-700/20 transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve Mutual Access
                            </button>
                          </>
                        ) : (req.status === 'accepted' || req.status === 'approved') ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                            <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                            Approved & Unlocked
                          </span>
                        ) : (
                          <span className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/40">
                            Declined
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Outbound Sent Photo Requests */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-zinc-900 dark:text-white text-base">
                  Sent Photo Requests ({outboundRequests.length})
                </h3>
              </div>
              <span className="text-xs text-zinc-500">Photo access requests you sent</span>
            </div>

            {outboundRequests.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800/80">
                <Eye className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">You haven't requested photo access from any candidates yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(outboundRequests || []).map((req) => {
                  const targetId = req.target_user_id || req.target_id || '';
                  const target = (req.target as Profile) || getProfileById(targetId);
                  const targetName = target?.full_name || (target ? getDisplayName(target) : 'Nikah Candidate');

                  return (
                    <div
                      key={req.id}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-700 dark:text-zinc-300 text-sm overflow-hidden">
                          {(req.status === 'accepted' || req.status === 'approved') && target?.avatar_url ? (
                            <img
                              src={target.avatar_url}
                              alt={targetName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Lock className="w-5 h-5 text-indigo-500" />
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                            {targetName}
                          </h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {target?.profession || 'Professional'} • {target?.location || target?.city || 'India'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {req.status === 'pending' ? (
                          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                            Pending Candidate Approval
                          </span>
                        ) : (req.status === 'accepted' || req.status === 'approved') ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                            <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                            Approved & Unlocked
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                            Declined
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
