'use client';

// ==============================================================================
// PROFILE CARD COMPONENT - ISLAMIC MATRIMONIAL WITH ZERO-DOWRY & 2-WAY PRIVACY
// ==============================================================================

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Video,
  Phone,
  BadgeCheck,
  Eye,
  Crown,
  MapPin,
  Briefcase,
  HeartHandshake,
  MessageSquare,
  UserCheck,
  UserPlus,
  Clock,
  XCircle,
  Heart,
  BookOpen,
} from 'lucide-react';
import { ProfileSecureView, SubscriptionTier, ConsentStatus, ConnectionPairStatus } from '../../types';
import { WatermarkedImage } from '../privacy/WatermarkedImage';
import { getDisplayName } from '../../lib/utils';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { Link } from '../common/Link';

export interface ProfileCardProps {
  profile: ProfileSecureView;
  viewerTier: SubscriptionTier;
  viewerProfile: ProfileSecureView;
  isSelf: boolean;
  consentStatus: ConsentStatus | 'none';
  status?: 'none' | 'pending' | 'accepted' | 'rejected' | ConnectionPairStatus;
  connectionPairStatus?: ConnectionPairStatus;
  onSendConnectionRequest?: (targetId: string) => void;
  onRespondConnection?: (targetId: string, status: 'accepted' | 'rejected') => void;
  onSendConsentRequest: (targetId: string) => void;
  onOpenWaliModal: (profile: ProfileSecureView) => void;
  onOpenPricing: () => void;
  onStartCall: (targetId: string, type: 'voice' | 'video') => void;
  onOpenChat?: (profile: ProfileSecureView) => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  viewerTier,
  viewerProfile,
  isSelf,
  consentStatus,
  status,
  connectionPairStatus = 'none',
  onSendConnectionRequest,
  onRespondConnection,
  onSendConsentRequest,
  onOpenWaliModal,
  onOpenPricing,
  onStartCall,
  onOpenChat,
}) => {
  const [gateNotice, setGateNotice] = useState<string | null>(null);
  const [localConsentStatus, setLocalConsentStatus] = useState<ConsentStatus | 'none'>(consentStatus);

  // Evaluate relationship status across status prop, connectionPairStatus prop, store, and database
  const [internalStatus, setInternalStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected' | ConnectionPairStatus>(() => {
    if (status && status !== 'none') return status;
    if (connectionPairStatus && connectionPairStatus !== 'none') return connectionPairStatus;
    if (viewerProfile?.id && profile?.id) {
      return daheejStore.getConnectionPairStatus(viewerProfile.id, profile.id);
    }
    return 'none';
  });

  React.useEffect(() => {
    if (status) {
      setInternalStatus(status);
    } else if (connectionPairStatus) {
      setInternalStatus(connectionPairStatus);
    }
  }, [status, connectionPairStatus]);

  // Query relationships table (connections) to audit relationship status between auth.uid() and displayed profile
  React.useEffect(() => {
    if (isSelf || !viewerProfile?.id || !profile.id) return;
    let isMounted = true;

    const checkDirectRelationship = async () => {
      try {
        const { data, error } = await supabase
          .from('connections')
          .select('id, sender_id, receiver_id, status, updated_at, created_at')
          .or(`and(sender_id.eq.${viewerProfile.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${viewerProfile.id})`);

        if (!error && data && data.length > 0 && isMounted) {
          data.forEach((connRec: any) => daheejStore.setConnectionFromRemote(connRec, false));
          const acceptedRec = data.find((d: any) => d.status === 'accepted');
          if (acceptedRec) {
            setInternalStatus('accepted');
          } else {
            const latest = [...data].sort((a: any, b: any) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())[0];
            if (latest.status === 'pending') {
              setInternalStatus(latest.sender_id === viewerProfile.id ? 'pending_sent' : 'pending_received');
            } else if (latest.status === 'rejected') {
              setInternalStatus('rejected');
            }
          }
        }
      } catch (err) {
        // quiet fallback
      }
    };

    checkDirectRelationship();

    const channel = supabase
      .channel(`card_conn_${viewerProfile.id}_${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections' },
        (payload) => {
          if (!isMounted) return;
          const rec = (payload.new || payload.old) as any;
          if (rec) {
            if (
              (rec.sender_id === viewerProfile.id && rec.receiver_id === profile.id) ||
              (rec.sender_id === profile.id && rec.receiver_id === viewerProfile.id)
            ) {
              if (rec.status === 'accepted') {
                setInternalStatus('accepted');
              } else if (rec.status === 'pending') {
                setInternalStatus(rec.sender_id === viewerProfile.id ? 'pending_sent' : 'pending_received');
              } else if (rec.status === 'rejected') {
                setInternalStatus('rejected');
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [viewerProfile?.id, profile.id, isSelf]);

  const isMatched =
    status === 'accepted' ||
    internalStatus === 'accepted' ||
    connectionPairStatus === 'accepted' ||
    (viewerProfile?.id ? daheejStore.hasAcceptedConnection(viewerProfile.id, profile.id) : false);

  // Sync prop changes to local state
  React.useEffect(() => {
    setLocalConsentStatus(consentStatus);
  }, [consentStatus]);

  // Fetch initial status and subscribe to realtime photo_access_requests and photo_permissions updates
  React.useEffect(() => {
    if (isSelf || !viewerProfile?.id || !profile.id) return;

    const fetchStatus = async () => {
      try {
        // 1. Try photo_access_requests table first
        const { data: accessData } = await supabase
          .from('photo_access_requests')
          .select('status, grantee_id, grantor_id, requestor_id, target_id')
          .or(`and(grantee_id.eq.${viewerProfile.id},grantor_id.eq.${profile.id}),and(grantee_id.eq.${profile.id},grantor_id.eq.${viewerProfile.id}),and(requestor_id.eq.${viewerProfile.id},target_id.eq.${profile.id})`)
          .limit(1);

        if (accessData && accessData.length > 0) {
          const s = accessData[0].status;
          setLocalConsentStatus(s === 'approved' ? 'approved' : s);
          return;
        }

        // 2. Fallback to photo_permissions
        const { data, error } = await supabase
          .from('photo_permissions')
          .select('status, requestor_id, target_id, requester_id, target_user_id')
          .or(`and(requestor_id.eq.${viewerProfile.id},target_id.eq.${profile.id}),and(requestor_id.eq.${profile.id},target_id.eq.${viewerProfile.id}),and(requester_id.eq.${viewerProfile.id},target_user_id.eq.${profile.id}),and(requester_id.eq.${profile.id},target_user_id.eq.${viewerProfile.id})`)
          .limit(1);

        if (data && data.length > 0 && !error) {
          const s = data[0].status;
          setLocalConsentStatus(s === 'approved' ? 'approved' : s);
        }
      } catch (err) {
        console.warn('Failed to fetch photo permission:', err);
      }
    };

    fetchStatus();

    // Channel for photo_access_requests
    const channelAccess = supabase.channel(`photo_access_req_${profile.id}_${viewerProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photo_access_requests',
        },
        (payload) => {
          const record = (payload.new || payload.old) as any;
          if (record) {
            const grantee = record.grantee_id || record.requestor_id;
            const grantor = record.grantor_id || record.target_id;
            if (
              (grantee === viewerProfile.id && grantor === profile.id) ||
              (grantee === profile.id && grantor === viewerProfile.id)
            ) {
              const s = record.status;
              setLocalConsentStatus(s === 'approved' ? 'approved' : s);
            }
          }
        }
      )
      .subscribe();

    // Channel for photo_permissions
    const channelPerm = supabase.channel(`photo_updates_${profile.id}_${viewerProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photo_permissions',
        },
        (payload) => {
          const record = (payload.new || payload.old) as any;
          if (record) {
            const req = record.requestor_id || record.requester_id;
            const tgt = record.target_id || record.target_user_id;
            if (
              (req === viewerProfile.id && tgt === profile.id) ||
              (req === profile.id && tgt === viewerProfile.id)
            ) {
              const s = record.status;
              setLocalConsentStatus(s === 'approved' ? 'approved' : s);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelAccess);
      supabase.removeChannel(channelPerm);
    };
  }, [viewerProfile?.id, profile.id, isSelf]);
  
  // Exclusive Photo Privacy: Photos are unlocked if viewing self or if an approved photo consent exists
  const viewerIsKYCVerified = Boolean(
    viewerProfile?.kyc_status === 'verified' ||
    viewerProfile?.selfie_verified === true ||
    viewerProfile?.is_verified === true ||
    (viewerProfile as any)?.id_verified === true
  );
  const hasStoreConsent = viewerProfile?.id ? daheejStore.hasAcceptedPhotoConsent(viewerProfile.id, profile.id) : false;
  const isPhotoUnlocked = isSelf || hasStoreConsent || localConsentStatus === 'accepted' || (localConsentStatus as string) === 'approved';

  // Wali presence on the candidate profile
  const hasWaliOverseen = Boolean(
    profile.has_wali ||
    profile.wali_contact_number ||
    profile.wali_phone ||
    profile.wali_email ||
    profile.wali_name
  );

  // Wali Access Permission: BASED STRICTLY ON THE LOGGED-IN VIEWER'S TIER
  const viewerHasDiamondWaliAccess = viewerTier === 'diamond' || viewerProfile?.subscription_tier === 'diamond' || (viewerProfile as any as any)?.membership_tier === 'diamond';

  // Real user name resolution with fallback
  const displayName = getDisplayName(profile);
  
  // Dynamic Gender & Role Label
  const candidateRole = profile.gender === 'female' ? 'Bride Candidate' : 'Groom Candidate';

  // Sanitized Strings
  const sanitizedProfession = profile.profession?.trim() || 'Profession Not Specified';
  const sanitizedLocation = (profile.city || profile.location)?.trim() || 'Location Not Specified';

  // Dynamic Badge Flags (strictly derived from data)
  const isVerifiedBadge = Boolean(
    profile.is_verified === true ||
    profile.kyc_status === 'verified' ||
    profile.selfie_verified === true
  );

  const isZeroDowryBadge = Boolean(
    profile.dowry_pledge_signed === true ||
    profile.anti_dowry_pledged === true
  );

  const isDiamondBadge = Boolean(
    profile.membership_tier === 'diamond' ||
    profile.subscription_tier === 'diamond'
  );

  const triggerGatedNotice = (actionName: string) => {
    setGateNotice(`Mutual Match Required: Send and accept a match request before accessing ${actionName}.`);
    setTimeout(() => {
      setGateNotice(null);
    }, 3500);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5 flex flex-col relative">
      {/* Compact Badges Row (Consolidated small elegant tags) */}
      <div className="flex items-center justify-between gap-1.5 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {isVerifiedBadge && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60"
              title="Identity cryptographically verified via Didit protocol"
            >
              <BadgeCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              Verified
            </span>
          )}

          {isZeroDowryBadge && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
              <HeartHandshake className="w-3 h-3 text-emerald-600" />
              Zero Dowry
            </span>
          )}

          {hasWaliOverseen && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide px-2 py-1 rounded-md bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/60">
              <ShieldCheck className="w-3 h-3 text-teal-600" />
              Wali Overseen
            </span>
          )}
        </div>

        {isDiamondBadge && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shrink-0">
            <Crown className="w-3 h-3 text-amber-500" />
            Diamond
          </span>
        )}
      </div>

      {/* Profile Image (Full width of card's inner padding with Haya Mode overlay) */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <WatermarkedImage
          src={profile.avatar_url}
          alt={displayName}
          fallbackInitial={displayName?.charAt(0)?.toUpperCase()}
          viewerId={viewerProfile?.id || ''}
          isUnlocked={isPhotoUnlocked}
          blurMessage={
            profile.photo_privacy
              ? 'Haya Mode: Photo Protected'
              : 'Private Photo'
          }
          className="w-full h-full object-cover"
        />

        {/* Floating Photo Privacy Status Badge when unlocked */}
        {isPhotoUnlocked && profile.avatar_url && (
          <div
            className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md border border-white/20 text-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 shadow-sm"
            title="Photo Privacy Unlocked"
          >
            <Eye className="w-3 h-3" />
            <span>Unlocked</span>
          </div>
        )}
      </div>

      {/* Name & Demographics with bold typography and muted secondary details */}
      <div className="mt-4 text-left">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>{displayName}</span>
            {isSelf && (
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                (You)
              </span>
            )}
          </h3>
          {profile.age && (
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
              {profile.age} yrs
            </span>
          )}
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 truncate">
          {candidateRole} • {sanitizedProfession}
        </p>

        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1 truncate">
          <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{sanitizedLocation}</span>
        </p>
      </div>

      {/* Matrimonial Highlights */}
      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 text-left">
        {profile.prayer_frequency && (
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{profile.prayer_frequency}</span>
          </div>
        )}

        {profile.sect && (
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Sect: {profile.sect}</span>
          </div>
        )}

        {profile.bio && (
          <p className="text-zinc-500 dark:text-zinc-400 text-xs line-clamp-2 mt-1 italic">
            "{profile.bio}"
          </p>
        )}
      </div>

      {/* Gate Alert Banner */}
      {gateNotice && (
        <div className="w-full mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs text-left flex items-start gap-2 shadow-xs">
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <span>{gateNotice}</span>
        </div>
      )}

      {/* Actions Container - Pushed cleanly to card bottom */}
      {!isSelf && (
        <div className="w-full mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col gap-2">
          {/* Mutual Match Status */}
          {isMatched ? (
            <div className="space-y-2 w-full mt-auto">
              <div className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center gap-1.5 shadow-xs">
                <Heart className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                <span>Mutual Match Confirmed</span>
              </div>

              {/* Wali Contact */}
              {viewerHasDiamondWaliAccess ? (
                <button
                  id={`btn-view-wali-${profile.id}`}
                  onClick={() => onOpenWaliModal(profile)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Contact Guardian / Wali</span>
                </button>
              ) : (
                <button
                  id={`btn-unlock-wali-${profile.id}`}
                  onClick={onOpenPricing}
                  className="w-full py-2 px-3 rounded-xl text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Wali Access (Diamond Tier)</span>
                </button>
              )}

              {/* Chat & Call options */}
              <div className="space-y-1.5 w-full">
                {onOpenChat ? (
                  <button
                    id={`btn-chat-${profile.id}`}
                    type="button"
                    onClick={() => onOpenChat(profile)}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Open Encrypted Chat</span>
                  </button>
                ) : (
                  <Link href="/messages" className="w-full block">
                    <button
                      id={`btn-chat-link-${profile.id}`}
                      type="button"
                      className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Open Encrypted Chat</span>
                    </button>
                  </Link>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    id={`btn-voice-call-${profile.id}`}
                    type="button"
                    onClick={() => onStartCall(profile.id, 'voice')}
                    className="py-2 px-2.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Voice</span>
                  </button>
                  <button
                    id={`btn-video-call-${profile.id}`}
                    type="button"
                    onClick={() => onStartCall(profile.id, 'video')}
                    className="py-2 px-2.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Video</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Primary Action Button: Send / Pending / Accept */}
              {internalStatus === 'none' && onSendConnectionRequest && (
                <button
                  id={`btn-send-match-${profile.id}`}
                  type="button"
                  onClick={() => onSendConnectionRequest(profile.id)}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 mt-auto transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Send Match Request</span>
                </button>
              )}

              {(internalStatus === 'pending_sent' || internalStatus === 'pending') && (
                <button
                  disabled
                  type="button"
                  className="w-full rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 font-semibold py-3 mt-auto flex items-center justify-center gap-2 cursor-not-allowed opacity-95"
                >
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Proposal Pending</span>
                </button>
              )}

              {internalStatus === 'pending_received' && onRespondConnection && (
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <button
                    id={`btn-accept-match-${profile.id}`}
                    type="button"
                    onClick={() => onRespondConnection(profile.id, 'accepted')}
                    className="py-3 px-3 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Accept Match</span>
                  </button>
                  <button
                    id={`btn-decline-match-${profile.id}`}
                    type="button"
                    onClick={() => onRespondConnection(profile.id, 'rejected')}
                    className="py-3 px-3 rounded-xl font-semibold text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Decline</span>
                  </button>
                </div>
              )}

              {/* Photo Access Request if Locked */}
              {!isPhotoUnlocked && (
                <div className="w-full">
                  {localConsentStatus === 'pending' ? (
                    <button
                      disabled
                      type="button"
                      className="w-full py-2 px-3 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center gap-1.5 cursor-not-allowed"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Photo Consent Pending</span>
                    </button>
                  ) : (
                    <button
                      id={`btn-request-photo-${profile.id}`}
                      type="button"
                      onClick={async () => {
                        if (!viewerIsKYCVerified) {
                          setGateNotice('KYC Verification Required: You must verify your identity with Didit before requesting photo consent.');
                          setTimeout(() => setGateNotice(null), 3500);
                          return;
                        }
                        setLocalConsentStatus('pending');
                        try {
                          await supabase.from('photo_access_requests').insert({
                            grantee_id: viewerProfile.id,
                            grantor_id: profile.id,
                            requestor_id: viewerProfile.id,
                            target_id: profile.id,
                            status: 'pending',
                          });
                        } catch (e) {
                          console.warn('[ProfileCard] insert photo_access_requests note:', e);
                        }
                        onSendConsentRequest(profile.id);
                      }}
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Request Photo Access</span>
                    </button>
                  )}
                </div>
              )}

              {/* Wali & Chat Actions */}
              <div className="space-y-2 mt-1">
                {viewerHasDiamondWaliAccess ? (
                  <button
                    id={`btn-view-wali-${profile.id}`}
                    onClick={() => onOpenWaliModal(profile)}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Contact Guardian / Wali</span>
                  </button>
                ) : (
                  <button
                    id={`btn-unlock-wali-${profile.id}`}
                    onClick={onOpenPricing}
                    className="w-full py-2 px-3 rounded-xl text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Wali Access (Diamond Tier)</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const MatchCard = ProfileCard;

