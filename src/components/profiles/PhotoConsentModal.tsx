'use client';

// ==============================================================================
// 2-WAY PHOTO CONSENT MODAL COMPONENT
// ==============================================================================

import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Heart,
  Send,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';
import { ProfileSecureView, ConsentStatus } from '../../types';

interface PhotoConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetProfile: ProfileSecureView | null;
  consentStatus: ConsentStatus;
  onRequestConsent: (targetId: string) => void;
  onAcceptConsent?: (requestId: string) => void;
  onRejectConsent?: (requestId: string) => void;
  onRevokeConsent?: (targetId: string) => void;
  onInstantGrant?: (targetId: string) => void;
  inboundRequestId?: string | null;
}

export const PhotoConsentModal: React.FC<PhotoConsentModalProps> = ({
  isOpen,
  onClose,
  targetProfile,
  consentStatus,
  onRequestConsent,
  onAcceptConsent,
  onRejectConsent,
  onRevokeConsent,
  onInstantGrant,
  inboundRequestId,
}) => {
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen || !targetProfile) return null;

  const handleSendRequest = () => {
    setIsSending(true);
    setTimeout(() => {
      onRequestConsent(targetProfile.id);
      setIsSending(false);
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1500);
    }, 400);
  };

  const handleInstantGrant = () => {
    setIsSending(true);
    if (onInstantGrant) {
      onInstantGrant(targetProfile.id);
    } else {
      onRequestConsent(targetProfile.id);
    }
    setSentSuccess(true);
    setTimeout(() => {
      setIsSending(false);
      setSentSuccess(false);
      onClose();
    }, 1200);
  };

  const handleRevoke = () => {
    if (onRevokeConsent) {
      onRevokeConsent(targetProfile.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 transition-colors">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">2-Way Mutual Photo Privacy</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Shariah-Compliant Modesty Protocol</p>
          </div>
        </div>

        {/* Profile Snapshot Card */}
        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 transition-colors">
          <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center shadow-sm">
            {targetProfile.photo_access_granted && targetProfile.avatar_url ? (
              <img
                src={targetProfile.avatar_url}
                alt={targetProfile.full_name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400/80" />
              </div>
            )}
          </div>
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-sm">{targetProfile.full_name}</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {targetProfile.profession || 'Professional'} • {targetProfile.location || 'Verified Location'}
            </p>
            <div className="mt-1">
              {consentStatus === 'accepted' ? (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> Mutual Photo Access Granted
                </span>
              ) : consentStatus === 'pending' ? (
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Photo Request Pending Approval
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Photos Gated by Consent
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Islamic Privacy Context */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 space-y-2">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>How Photo Gating Works:</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 list-disc list-inside">
            <li>Profile photos are blurred and encrypted until both parties mutually agree.</li>
            <li>Sending a request notifies the candidate discreetly without broadcasting public photos.</li>
            <li>Access can be revoked at any time from your Privacy Dashboard.</li>
          </ul>
        </div>

        {/* Action States */}
        {consentStatus === 'accepted' ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-600/40 text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">You both have photo access!</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                You can view each other's verified matrimonial photos in full clarity.
              </p>
            </div>
            {onRevokeConsent && (
              <button
                onClick={handleRevoke}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                Revoke Photo Access
              </button>
            )}
          </div>
        ) : consentStatus === 'pending' ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-600/40 text-center space-y-2">
              <Shield className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto animate-pulse" />
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Request is Pending</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                The candidate has received your photo viewing invitation. You will be notified as soon as they accept.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleInstantGrant}
                className="py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Unlock className="w-3.5 h-3.5" />
                Grant Access Now
              </button>
              {onRevokeConsent && (
                <button
                  onClick={handleRevoke}
                  className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Withdraw Request
                </button>
              )}
            </div>
          </div>
        ) : inboundRequestId && onAcceptConsent && onRejectConsent ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-700 dark:text-zinc-300 text-center">
              {targetProfile.full_name} has requested mutual photo viewing access.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onAcceptConsent(inboundRequestId)}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Accept & Share
              </button>
              <button
                onClick={() => onRejectConsent(inboundRequestId)}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-2 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Decline
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sentSuccess ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/50 rounded-xl text-center text-xs font-semibold">
                Photo request transmitted successfully!
              </div>
            ) : (
              <>
                <button
                  id="btn-confirm-send-consent"
                  onClick={handleSendRequest}
                  disabled={isSending}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-all hover:scale-[1.02]"
                >
                  {isSending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Transmitting Request...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Request Mutual Photo Access
                    </>
                  )}
                </button>
                <button
                  onClick={handleInstantGrant}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Grant Mutual Access Immediately
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default PhotoConsentModal;
