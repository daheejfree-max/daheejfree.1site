// ==============================================================================
// STRICT PRODUCTION HARD KYC VERIFICATION GATE (UN-DISMISSIBLE PLATFORM WALL)
// ==============================================================================

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Camera,
  FileCheck,
  ExternalLink,
  RefreshCw,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Logo } from '../brand/Logo';
import { SelfieVerificationModal } from '../verification/SelfieVerificationModal';
import { GovtIdVerificationModal } from '../verification/GovtIdVerificationModal';
import { Profile } from '../../types/database';
import { daheejStore } from '../../lib/supabase/store';

interface HardKYCGateProps {
  currentProfile: Profile;
  onRefreshProfile: () => Promise<void> | void;
  onSignOut: () => void;
  onUpdateProfile?: (updates: Partial<Profile>) => void;
}

export const HardKYCGate: React.FC<HardKYCGateProps> = ({
  currentProfile,
  onRefreshProfile,
  onSignOut,
  onUpdateProfile,
}) => {
  const [isStartingDidit, setIsStartingDidit] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSelfieModalOpen, setIsSelfieModalOpen] = useState(false);
  const [isGovtIdModalOpen, setIsGovtIdModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isSelfieVerified = Boolean(currentProfile.selfie_verified);
  const isDocVerified = Boolean(currentProfile.kyc_document_url || currentProfile.kyc_status === 'verified');

  // Initiate real Didit.me Government ID & Biometric Verification Session
  const handleStartDiditSession = async () => {
    setIsStartingDidit(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/kyc/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentProfile.id,
          returnUrl: window.location.href,
        }),
      });

      let data: any = null;
      try {
        const responseText = await response.text();
        data = JSON.parse(responseText);
      } catch {
        console.warn('[HardKYCGate] Non-JSON response received from verify endpoint');
      }

      if (data?.sessionUrl) {
        if (onUpdateProfile) {
          onUpdateProfile({
            kyc_session_id: data.sessionId,
            didit_session_url: data.sessionUrl,
            kyc_status: 'pending',
          });
        }
        daheejStore.updateProfile(currentProfile.id, {
          kyc_session_id: data.sessionId,
          didit_session_url: data.sessionUrl,
          kyc_status: 'pending',
        });

        // Launch Didit.me verification window
        window.open(data.sessionUrl, '_blank', 'noopener,noreferrer');
        setStatusMessage(
          'Didit verification opened in a new tab. Complete your verification and click "Check Verification Status" below.'
        );
      } else {
        // If Didit server key is not configured, open the built-in Government ID upload modal directly
        setIsGovtIdModalOpen(true);
      }
    } catch (err: any) {
      console.error('[HardKYCGate] Didit session initialization error:', err);
      // Fallback seamlessly to direct Government ID document modal without broken alert
      setIsGovtIdModalOpen(true);
    } finally {
      setIsStartingDidit(false);
    }
  };

  // Poll / Refresh verification status from backend & database
  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    setError(null);
    setStatusMessage(null);

    try {
      // 1. If user has a pending session ID, query the decision endpoint
      if (currentProfile.kyc_session_id) {
        const response = await fetch('/api/kyc/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: currentProfile.id,
            sessionId: currentProfile.kyc_session_id,
          }),
        });

        let data: any = null;
        try {
          const responseText = await response.text();
          data = JSON.parse(responseText);
        } catch {
          console.warn('[HardKYCGate] Non-JSON decision response');
        }

        if (data && (data.verified || data.status === 'verified')) {
          daheejStore.updateProfile(currentProfile.id, {
            kyc_status: 'verified',
            kyc_verified: true,
            is_verified: true,
          });
          if (onUpdateProfile) {
            onUpdateProfile({
              kyc_status: 'verified',
              kyc_verified: true,
              is_verified: true,
            });
          }
          setStatusMessage('Identity successfully verified. Redirecting to platform...');
          await onRefreshProfile();
          return;
        }
      }

      await onRefreshProfile();
      setStatusMessage('Verification status checked against official records.');
    } catch (err: any) {
      console.error('[HardKYCGate] Refresh error:', err);
      setError(err?.message || 'Unable to refresh verification status at this moment.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleVerificationCompleted = async () => {
    if (onUpdateProfile) {
      onUpdateProfile({
        kyc_status: 'verified',
        kyc_verified: true,
        is_verified: true,
      });
    }
    await onRefreshProfile();
  };

  return (
    <div
      id="hard-kyc-gate-container"
      className="fixed inset-0 z-[9990] bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-fade-in my-auto">
        {/* Brand & Badge Header */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <Logo size="md" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Lock className="w-3.5 h-3.5" />
            <span>Strict Production Security Protocol</span>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
          <ShieldAlert className="w-8 h-8 text-amber-400 animate-pulse" />
        </div>

        {/* Explanatory Content */}
        <div className="space-y-2 max-w-md mx-auto">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Identity Verification Required
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            To uphold a 100% genuine, bot-free, and dowry-free Islamic matrimonial environment, all candidate profiles must complete Government ID or Biometric Verification before accessing matches, messaging, or calling.
          </p>
        </div>

        {/* Verification Status Matrix */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className={`p-3.5 rounded-2xl border ${
            isSelfieVerified 
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300' 
              : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-300'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold">Live Biometrics</span>
            </div>
            <span className="text-[11px] text-zinc-400">
              {isSelfieVerified ? 'Biometric check verified' : 'Webcam liveness check'}
            </span>
          </div>

          <div className={`p-3.5 rounded-2xl border ${
            isDocVerified 
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300' 
              : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-300'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold">Government ID</span>
            </div>
            <span className="text-[11px] text-zinc-400">
              {isDocVerified ? 'Document verified' : 'Passport / National ID'}
            </span>
          </div>
        </div>

        {/* Dynamic Alerts */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2 text-left animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {statusMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-800/40 text-emerald-300 text-xs flex items-start gap-2 text-left animate-fade-in">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Primary Action Controls */}
        <div className="space-y-3 pt-2">
          {/* 1. Live Webcam Biometric Selfie Check */}
          <button
            id="btn-hard-gate-selfie"
            type="button"
            onClick={() => setIsSelfieModalOpen(true)}
            className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Start Live Webcam Biometric Check</span>
            <ArrowRight className="w-4 h-4 opacity-80" />
          </button>

          {/* 2. Official Government ID Verification */}
          <button
            id="btn-hard-gate-govt-id"
            type="button"
            onClick={() => setIsGovtIdModalOpen(true)}
            className="w-full py-3 px-4 rounded-2xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>Upload Government ID (Passport / National ID)</span>
          </button>

          {/* 3. Optional: Didit.me Gateway Trigger */}
          <button
            id="btn-hard-gate-didit"
            type="button"
            onClick={handleStartDiditSession}
            disabled={isStartingDidit}
            className="w-full py-2.5 px-4 rounded-2xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>{isStartingDidit ? 'Connecting to Didit Gateway...' : 'Or Verify with Didit.me Identity Gateway'}</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </button>

          {/* 4. Status Poll & Sign Out row */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
            <button
              id="btn-hard-gate-refresh"
              type="button"
              onClick={handleRefreshStatus}
              disabled={isRefreshing}
              className="py-2.5 px-4 rounded-xl text-xs font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Check Verification Status</span>
            </button>

            <button
              id="btn-hard-gate-signout"
              type="button"
              onClick={onSignOut}
              className="py-2.5 px-4 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Selfie Biometric Verification Modal */}
      <SelfieVerificationModal
        isOpen={isSelfieModalOpen}
        onClose={() => setIsSelfieModalOpen(false)}
        userId={currentProfile.id}
        onVerificationComplete={async () => {
          setIsSelfieModalOpen(false);
          await handleVerificationCompleted();
        }}
      />

      {/* Government ID Document Verification Modal */}
      <GovtIdVerificationModal
        isOpen={isGovtIdModalOpen}
        onClose={() => setIsGovtIdModalOpen(false)}
        userId={currentProfile.id}
        onVerificationComplete={async () => {
          setIsGovtIdModalOpen(false);
          await handleVerificationCompleted();
        }}
      />
    </div>
  );
};
