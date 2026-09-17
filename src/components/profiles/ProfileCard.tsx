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

interface ProfileCardProps {
  profile: ProfileSecureView;
  viewerTier: SubscriptionTier;
  viewerProfile: ProfileSecureView;
  isSelf: boolean;
  consentStatus: ConsentStatus | 'none';
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

  const isMatched = connectionPairStatus === 'accepted';
  
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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative">
      {/* Top Banner / KYC & Anti-Dowry Badges */}
      <div className="p-5 pb-0 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {isVerifiedBadge && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-700/60 shadow-xs cursor-help"
              title="Identity cryptographically verified via Didit protocol"
            >
              <BadgeCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Didit Verified
            </span>
          )}

          {isZeroDowryBadge && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700/40">
              <HeartHandshake className="w-3 h-3" />
              Zero Dowry
            </span>
          )}

          {hasWaliOverseen && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/40">
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Wali Overseen
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isDiamondBadge && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 shadow-xs">
              <Crown className="w-3 h-3 text-amber-500" />
              DIAMOND
            </span>
          )}
        </div>
      </div>

      {/* Main Avatar Section with Forensic Watermarked Anti-Screenshot Image */}
      <div className="p-5 flex flex-col items-center text-center">
        <div className="relative w-28 h-28 mx-auto rounded-2xl overflow-hidden mb-3 border border-neutral-800 bg-neutral-900/90 flex items-center justify-center shadow-inner group">
          <WatermarkedImage
            src={profile.avatar_url}
            alt={displayName}
            fallbackInitial={displayName?.charAt(0)?.toUpperCase()}
            viewerId={viewerProfile?.id || ''}
            isUnlocked={isPhotoUnlocked}
            blurMessage={
              profile.photo_privacy
                ? 'Haya Mode: Blurred'
                : 'Private Photo'
            }
            className="w-full h-full object-cover"
          />

          {isPhotoUnlocked && profile.avatar_url && (
            <div
              className="absolute bottom-1.5 right-1.5 bg-emerald-950/85 backdrop-blur-sm border border-emerald-500/60 text-emerald-300 p-1 rounded-full text-[9px] shadow-sm"
              title="Photo Privacy Unlocked"
            >
              <Eye className="w-3 h-3" />
            </div>
          )}
        </div>

        {/* Name & Demographics */}
        <h3 className="text-lg font-bold text-zinc-900 dark:text-neutral-100 tracking-tight flex items-center gap-1.5 justify-center">
          <span>{displayName}</span>
          {isSelf && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">(You)</span>}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {profile.age ? `${profile.age} yrs • ` : ''}{candidateRole}{` • ${sanitizedProfession}`}
        </p>

        {/* Mutual Match Status or Primary CTA */}
        {!isSelf && (
          <div className="w-full mt-3">
            {connectionPairStatus === 'none' && onSendConnectionRequest && (
              <button
                id={`btn-send-match-${profile.id}`}
                type="button"
                onClick={() => onSendConnectionRequest(profile.id)}
                className="w-full py-2 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md hover:shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Send Match Request</span>
              </button>
            )}

            {connectionPairStatus === 'pending_sent' && (
              <button
                disabled
                type="button"
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Proposal Pending</span>
              </button>
            )}

            {connectionPairStatus === 'pending_received' && onRespondConnection && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  id={`btn-accept-match-${profile.id}`}
                  type="button"
                  onClick={() => onRespondConnection(profile.id, 'accepted')}
                  className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all hover:scale-105 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Accept Match
                </button>
                <button
                  id={`btn-decline-match-${profile.id}`}
                  type="button"
                  onClick={() => onRespondConnection(profile.id, 'rejected')}
                  className="py-2 px-3 rounded-xl text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Decline
                </button>
              </div>
            )}

            {connectionPairStatus === 'accepted' && (
              <div className="w-full py-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center gap-1.5">
                <Heart className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                <span>Mutual Match Confirmed</span>
              </div>
            )}
          </div>
        )}

        {/* Photo Consent Action */}
        {!isSelf && !isPhotoUnlocked && (
          <div className="mt-2.5 flex flex-col items-center gap-1.5 w-full">
            {localConsentStatus === 'pending' ? (
              <>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Photo Access Requested (Pending Approval)
                </span>
                <button
                  disabled
                  type="button"
                  className="w-full py-1.5 px-3 rounded-xl text-xs font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-700 flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Request Sent</span>
                </button>
              </>
            ) : (
              <button
                id={`btn-request-photo-${profile.id}`}
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
                className="w-full py-1.5 px-3 rounded-xl text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Request Photo Access</span>
              </button>
            )}
          </div>
        )}

        {/* Gate Alert Banner */}
        {gateNotice && (
          <div className="w-full mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-[11px] text-left flex items-start gap-2 animate-fade-in shadow-sm">
            <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>{gateNotice}</span>
          </div>
        )}

        {/* Key Matrimonial Highlights */}
        <div className="w-full text-left mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
          {profile.prayer_frequency && (
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="truncate">{profile.prayer_frequency}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="truncate">{sanitizedProfession}</span>
          </div>

          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="truncate">{sanitizedLocation}</span>
          </div>

          {profile.bio && (
            <p className="text-zinc-600 dark:text-zinc-400 text-xs line-clamp-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/40 italic">
              "{profile.bio}"
            </p>
          )}
        </div>
      </div>

      {/* Sensitive Wali Gating Section */}
      <div className="p-4 bg-zinc-50 dark:bg-zinc-950/80 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Guardian / Wali:
          </span>

          {viewerHasDiamondWaliAccess ? (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Diamond Unlocked
            </span>
          ) : (
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-500" />
              Requires Diamond
            </span>
          )}
        </div>

        {/* Wali Access based on viewer's tier */}
        {viewerHasDiamondWaliAccess ? (
          <button
            id={`btn-view-wali-${profile.id}`}
            onClick={() => onOpenWaliModal(profile)}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            Contact Guardian / Wali
          </button>
        ) : (
          <button
            id={`btn-unlock-wali-${profile.id}`}
            onClick={onOpenPricing}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 dark:bg-zinc-900 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-600/40 flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            Upgrade to Diamond for Wali Access
          </button>
        )}

        {/* Feature Gated WebRTC Video, Voice & Message Actions */}
        {!isSelf && (
          <div className="space-y-2 mt-1">
            {isMatched ? (
              onOpenChat && (
                <button
                  id={`btn-chat-${profile.id}`}
                  onClick={() => onOpenChat(profile)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open Encrypted Chat</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => triggerGatedNotice('Chat & Messaging')}
                className="w-full py-1.5 px-3 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Chat Locked (Match Required)</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              {isMatched ? (
                <>
                  <button
                    id={`btn-voice-call-${profile.id}`}
                    onClick={() => onStartCall(profile.id, 'voice')}
                    className="py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 hover:bg-emerald-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Voice Call
                  </button>

                  <button
                    id={`btn-video-call-${profile.id}`}
                    onClick={() => onStartCall(profile.id, 'video')}
                    className="py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 hover:bg-emerald-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Video Call
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => triggerGatedNotice('Voice Calling')}
                    className="py-1.5 px-2.5 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800/40 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <Lock className="w-3 h-3 text-zinc-400" />
                    Voice
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerGatedNotice('Video Calling')}
                    className="py-1.5 px-2.5 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800/40 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <Lock className="w-3 h-3 text-zinc-400" />
                    Video
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

