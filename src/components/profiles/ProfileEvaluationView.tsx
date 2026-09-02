'use client';

import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  CheckCircle,
  BadgeCheck,
  Sparkles,
  HeartHandshake,
  MessageSquare,
  Phone,
  Video,
  Lock,
  Unlock,
  Eye,
  Mail,
  MapPin,
  Briefcase,
  GraduationCap,
  Scale,
  BookOpen,
  UserCheck,
  UserPlus,
  Clock,
  XCircle,
  Heart,
  Calendar,
} from 'lucide-react';
import { ProfileSecureView, SubscriptionTier, ConsentStatus, ConnectionPairStatus } from '../../types';
import { WatermarkedImage } from '../privacy/WatermarkedImage';
import { AICompatibilityModal } from '../ai/AICompatibilityModal';
import { WaliPortalModal } from '../wali/WaliPortalModal';
import { getDisplayName } from '../../lib/utils';

interface ProfileEvaluationViewProps {
  profile: ProfileSecureView;
  viewerProfile: ProfileSecureView;
  viewerTier: SubscriptionTier;
  consentStatus: ConsentStatus | 'none';
  connectionPairStatus?: ConnectionPairStatus;
  onSendConnectionRequest?: (targetId: string) => void;
  onRespondConnection?: (targetId: string, status: 'accepted' | 'rejected') => void;
  onSendConsentRequest: (targetId: string) => void;
  onOpenPricing: () => void;
  onStartCall: (targetId: string, type: 'voice' | 'video') => void;
  onOpenChat?: (profile: ProfileSecureView) => void;
}

export const ProfileEvaluationView: React.FC<ProfileEvaluationViewProps> = ({
  profile,
  viewerProfile,
  viewerTier,
  consentStatus,
  connectionPairStatus = 'none',
  onSendConnectionRequest,
  onRespondConnection,
  onSendConsentRequest,
  onOpenPricing,
  onStartCall,
  onOpenChat,
}) => {
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isWaliModalOpen, setIsWaliModalOpen] = useState(false);
  const [gateNotice, setGateNotice] = useState<string | null>(null);

  const isSelf = profile.id === viewerProfile.id;
  const isMatched = connectionPairStatus === 'accepted';

  // Exclusive Photo Privacy: Being a "Match" does NOT grant photo access.
  // Photos are unlocked ONLY if viewing self or if an approved/accepted photo request exists.
  const isPhotoUnlocked = isSelf || consentStatus === 'accepted' || (consentStatus as string) === 'approved';

  // Real user name resolution with fallback
  const displayName = getDisplayName(profile);
  const candidateRole = profile.gender === 'female' ? 'Bride Candidate' : 'Groom Candidate';

  const triggerGatedNotice = (actionName: string) => {
    setGateNotice(`Mutual Match Required: Send and accept a match request before accessing ${actionName}.`);
    setTimeout(() => {
      setGateNotice(null);
    }, 3500);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
      {/* Top Header Strip: Verification & Wali Badges */}
      <div className="bg-zinc-50 dark:bg-zinc-950/80 p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Verified Blue Badge */}
          {profile.kyc_status === 'verified' || profile.selfie_verified ? (
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-700/60 shadow-xs cursor-help"
              title="Identity cryptographically verified via the Didit protocol to ensure authenticity and prevent fake profiles."
            >
              <BadgeCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ✓ Didit Verified
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-700/40 cursor-help"
              title="Pending Automated Didit KYC Verification"
            >
              Pending Didit KYC
            </span>
          )}

          {/* Wali Overseen Badge */}
          {profile.wali_email && (
            <button
              type="button"
              onClick={() => setIsWaliModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Wali Overseen
            </button>
          )}

          {/* Zero Dowry Badge */}
          {profile.anti_dowry_pledged && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-700/40">
              <HeartHandshake className="w-3.5 h-3.5" />
              100% Zero Dowry
            </span>
          )}
        </div>

        {/* AI Compatibility Button */}
        {!isSelf && (
          <button
            id={`btn-ai-compat-${profile.id}`}
            type="button"
            onClick={() => setIsAIModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
            <span>AI Compatibility Analysis</span>
          </button>
        )}
      </div>

      {/* Main Grid: Left Photo & Actions / Right Deep Evaluation Details */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Watermarked Anti-Screenshot Photo & Match Bar (4 Cols) */}
        <div className="md:col-span-4 flex flex-col items-center">
          <div className="w-full max-w-[240px] aspect-square rounded-3xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 shadow-md bg-zinc-100 dark:bg-zinc-950 relative">
            <WatermarkedImage
              src={profile.avatar_url}
              alt={displayName}
              fallbackInitial={displayName?.charAt(0)?.toUpperCase()}
              viewerId={viewerProfile.id}
              isUnlocked={isPhotoUnlocked}
              blurMessage={
                profile.photo_privacy
                  ? 'Haya Mode: Blurred'
                  : 'Private Photo'
              }
              className="w-full h-full object-cover"
            />

            {/* Photo Privacy Status Indicator */}
            {isPhotoUnlocked && profile.avatar_url && (
              <div
                className="absolute bottom-2 right-2 bg-emerald-950/80 backdrop-blur-sm border border-emerald-500/60 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                title="Photo Consent Active"
              >
                <Eye className="w-3 h-3" />
                <span>Unlocked</span>
              </div>
            )}
          </div>

          {/* Nickname & Age Summary */}
          <div className="text-center mt-3">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-neutral-100 tracking-tight flex items-center justify-center gap-1.5">
              <span>{displayName}</span>
              {isSelf && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">
                  (You)
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {profile.age ? `${profile.age} yrs • ` : ''}{candidateRole}{profile.profession ? ` • ${profile.profession}` : ''}
            </p>
          </div>

          {/* Photo Request Action (if locked) */}
          {!isSelf && !isPhotoUnlocked && (
            <div className="mt-3 w-full max-w-[240px]">
              {consentStatus === 'pending' ? (
                <div className="w-full py-1.5 px-3 rounded-xl text-xs font-medium bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/60 text-center">
                  Photo Request Pending
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSendConsentRequest(profile.id)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Request Photo Reveal
                </button>
              )}
            </div>
          )}

          {/* Match Request CTA Strip */}
          {!isSelf && (
            <div className="w-full max-w-[240px] mt-4 space-y-2">
              {connectionPairStatus === 'none' && onSendConnectionRequest && (
                <button
                  id={`btn-eval-match-${profile.id}`}
                  type="button"
                  onClick={() => onSendConnectionRequest(profile.id)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Send Match Request</span>
                </button>
              )}

              {connectionPairStatus === 'pending_sent' && (
                <div className="w-full py-2 px-3 rounded-xl text-xs font-medium bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700 flex items-center justify-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Match Request Awaiting Response</span>
                </div>
              )}

              {connectionPairStatus === 'pending_received' && onRespondConnection && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onRespondConnection(profile.id, 'accepted')}
                    className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center justify-center gap-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => onRespondConnection(profile.id, 'rejected')}
                    className="py-2 px-3 rounded-xl text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Decline
                  </button>
                </div>
              )}

              {connectionPairStatus === 'accepted' && (
                <div className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                  <span>Mutual Match Confirmed</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Communication Actions (Gated by match) */}
          {!isSelf && isMatched && (
            <div className="w-full max-w-[240px] mt-3 space-y-2">
              {onOpenChat && (
                <button
                  type="button"
                  onClick={() => onOpenChat(profile)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open Halal Chat</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onStartCall(profile.id, 'voice')}
                  className="py-1.5 px-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Voice</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartCall(profile.id, 'video')}
                  className="py-1.5 px-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center gap-1"
                >
                  <Video className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Video</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: In-Depth Scrollable Matrimonial Evaluation (8 Cols) */}
        <div className="md:col-span-8 space-y-5">
          {/* 1. Religious Practice & Deen Section */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Deen & Islamic Practice
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 block mb-0.5">Prayer Frequency (Salah):</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {profile.prayer_frequency || 'Regular 5 Daily Prayers'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 block mb-0.5">Sect / Madhab:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {profile.religious_sect || 'Sunni / Ahlus Sunnah'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 block mb-0.5">Quran Practice:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {profile.quran_recitation || 'Regular Recitation & Reflection'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 block mb-0.5">Islamic Practice Level:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {profile.religious_practice || 'Committed to Halal & Sunnah'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Professional & Academic Background */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Career & Education
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <Briefcase className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[11px]">Profession</span>
                  <span className="font-semibold text-zinc-900 dark:text-white truncate">
                    {profile.profession || 'Professional'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <GraduationCap className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[11px]">Education</span>
                  <span className="font-semibold text-zinc-900 dark:text-white truncate">
                    {profile.education || 'Graduate'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[11px]">Location</span>
                  <span className="font-semibold text-zinc-900 dark:text-white truncate">
                    {profile.location || profile.city || 'Not specified'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[11px]">Marital Status</span>
                  <span className="font-semibold text-zinc-900 dark:text-white truncate">
                    {profile.marital_status || 'Never Married'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Bio & Halal Icebreaker Questions */}
          {profile.bio && (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-2">
                Personal Statement & Islamic Aspirations
              </h4>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                "{profile.bio}"
              </p>
            </div>
          )}

          {/* 4. Guardian / Wali Contact Strip */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-emerald-950 dark:text-emerald-200 block">
                  Wali (Guardian) Supervision
                </span>
                <span className="text-emerald-800 dark:text-emerald-400 text-[11px]">
                  {profile.wali_name ? `${profile.wali_name} (${profile.wali_relation || 'Guardian'})` : 'Designated Wali Registered'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsWaliModalOpen(true)}
              className="py-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Contact Wali</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Compatibility Modal */}
      {isAIModalOpen && (
        <AICompatibilityModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          userProfile={viewerProfile}
          candidateProfile={profile}
        />
      )}

      {/* Wali Chaperone Modal */}
      {isWaliModalOpen && (
        <WaliPortalModal
          isOpen={isWaliModalOpen}
          onClose={() => setIsWaliModalOpen(false)}
          profile={profile}
          currentUserId={viewerProfile.id}
        />
      )}
    </div>
  );
};
