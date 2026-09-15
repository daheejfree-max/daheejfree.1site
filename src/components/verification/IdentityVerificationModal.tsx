'use client';

// ==============================================================================
// DIDIT.ME BIOMETRIC IDENTITY & KYC VERIFICATION LAUNCHER MODAL
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  X,
  Lock,
  Sparkles,
  ArrowRight,
  FileCheck,
  Camera,
} from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';

export interface IdentityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onVerificationComplete?: () => void;
}

export const IdentityVerificationModal: React.FC<IdentityVerificationModalProps> = ({
  isOpen,
  onClose,
  userId,
  onVerificationComplete,
}) => {
  const [isLaunching, setIsLaunching] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // Check initial verification status when modal opens
  useEffect(() => {
    if (!isOpen || !userId) return;

    const profile = daheejStore.getProfile(userId);
    if (profile?.kyc_verified || profile?.kyc_status === 'verified') {
      setIsVerified(true);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  // 1. Primary Action: Direct Launcher to Didit.me hosted portal
  const handleStartVerification = async () => {
    setIsLaunching(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/kyc/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          profileId: userId,
        }),
      });

      // Safe text parsing to prevent JSON parse crashes on unexpected HTML or gateway responses
      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error('Unexpected response format from verification server.');
      }

      if (!response.ok || (data && data.success === false && !data.url && !data.session_url)) {
        throw new Error(data?.error || 'Unable to create verification session. Please try again.');
      }

      const sessionUrl = data.url || data.session_url || data.verification_url;
      if (!sessionUrl) {
        throw new Error('Verification session URL was not returned by gateway.');
      }

      // Smoothly redirect candidate to Didit's mobile-ready verification portal
      setStatusMessage('Redirecting to Didit secure identity portal...');
      window.location.href = sessionUrl;
    } catch (err: unknown) {
      console.error('[IdentityVerification] Launcher error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to launch verification portal.';
      setErrorMessage(msg);
      setIsLaunching(false);
    }
  };

  // 2. Fallback: Query public.profiles directly for kyc_verified status
  const handleRefreshStatus = async () => {
    setIsCheckingStatus(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      // Direct query to public.profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('kyc_verified, kyc_status, id_verified, selfie_verified, is_verified')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[IdentityVerification] Profile query notice:', error);
      }

      const isKycApproved =
        data?.kyc_verified === true ||
        data?.kyc_status === 'verified' ||
        data?.is_verified === true;

      if (isKycApproved) {
        setIsVerified(true);
        setStatusMessage('Congratulations! Your identity and biometric KYC have been verified.');

        // Update local persistent store
        daheejStore.updateProfile(userId, {
          kyc_verified: true,
          kyc_status: 'verified',
          is_verified: true,
          id_verified: true,
          selfie_verified: true,
        });

        if (onVerificationComplete) {
          onVerificationComplete();
        }
      } else {
        const currentStatus = data?.kyc_status || 'pending';
        setStatusMessage(
          `Verification status: ${currentStatus.replace('_', ' ').toUpperCase()}. If you completed verification, please allow a moment for gateway synchronization.`
        );
      }
    } catch (err: unknown) {
      console.error('[IdentityVerification] Refresh error:', err);
      const msg = err instanceof Error ? err.message : 'Unable to refresh status.';
      setErrorMessage(msg);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-zinc-900 dark:text-zinc-100 transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>Identity & KYC Verification</span>
                <Sparkles className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Powered by Didit.me Enterprise Verification Gateway
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Verified Banner */}
        {isVerified ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 space-y-3 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              Identity Fully Verified!
            </h4>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              Your profile is verified with bank-grade biometric certification. You have full access to audio/video calls and direct matrimonial messaging.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition-all cursor-pointer"
            >
              Continue to DaheejFree
            </button>
          </div>
        ) : (
          <>
            {/* Feature List */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 space-y-1">
                <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h5 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-200">Biometric Liveness</h5>
                <p className="text-[10px] text-zinc-500 leading-tight">Fast, mobile-ready facial check</p>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 space-y-1">
                <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h5 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-200">Govt ID Check</h5>
                <p className="text-[10px] text-zinc-500 leading-tight">Passport, National ID, License</p>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 space-y-1">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h5 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-200">256-Bit Encrypted</h5>
                <p className="text-[10px] text-zinc-500 leading-tight">Zero data sharing or exposure</p>
              </div>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Status Notification */}
            {statusMessage && (
              <div className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              {/* Primary Direct Launcher Button */}
              <button
                id="btn-launch-didit-portal"
                type="button"
                disabled={isLaunching}
                onClick={handleStartVerification}
                className="w-full py-3.5 px-5 rounded-2xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-60"
              >
                {isLaunching ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Connecting to Didit Gateway...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Start Government ID Verification</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>

              {/* Fallback Refresh Status Button */}
              <button
                id="btn-refresh-kyc-status"
                type="button"
                disabled={isCheckingStatus}
                onClick={handleRefreshStatus}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                <span>Check Verification Status</span>
              </button>
            </div>

            <p className="text-[11px] text-center text-zinc-500 dark:text-zinc-400">
              Completed verification in Didit tab? Click "Check Verification Status" to sync your badge.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export const SelfieVerificationModal = IdentityVerificationModal;
export const IdentityVerification = IdentityVerificationModal;
