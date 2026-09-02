// ==============================================================================
// STRICT PRODUCTION HARD KYC VERIFICATION GATE (UN-DISMISSIBLE PLATFORM WALL)
// ==============================================================================

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Camera,
  ExternalLink,
  RefreshCw,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
} from 'lucide-react';
import { Logo } from '../brand/Logo';
import { SelfieVerificationModal } from '../verification/SelfieVerificationModal';
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

      if (!response.ok || !data?.success) {
        const errMsg = data?.error || 'Unable to connect to Didit identity gateway. You can complete your verification using the Live Webcam Biometric Selfie Check below.';
        throw new Error(errMsg);
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
        throw new Error(data?.error || 'No verification URL received from identity service. Please use the Live Webcam Biometric Selfie Check below.');
      }
    } catch (err: any) {
      console.error('[HardKYCGate] Didit session initialization error:', err);
      setError(
        err?.message ||
          'Unable to connect to Didit.me identity service. Please check your connection or use the Live Webcam Biometric Selfie Check.'
      );
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
      setStatusMessage('Verification status checked against the official registry.');
    } catch (err: any) {
      console.error('[HardKYCGate] Refresh error:', err);
      setError(err?.message || 'Unable to refresh verification status at this moment.');
    } finally {
      setIsRefreshing(false);
    }
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
            To uphold a 100% genuine, bot-free, and dowry-free Islamic matrimonial environment, all candidate profiles must complete Government ID & Biometric Verification before accessing matches, messaging, or calling.
          </p>
        </div>

        {/* Security Guarantees */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 text-left space-y-2 text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Cryptographic Government ID & Liveness Verification via Didit.me</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Zero Dowry charter enforcement & scam prevention</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Biometric privacy: selfie documents never shown to other users</span>
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

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          {/* 1. Primary: Launch Live Didit Verification */}
          <button
            id="btn-hard-gate-didit"
            type="button"
            onClick={handleStartDiditSession}
            disabled={isStartingDidit}
            className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {isStartingDidit ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Connecting to Didit Identity Gateway...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Start Govt ID Verification (Didit.me)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </>
            )}
          </button>

          {/* 2. Secondary: Live Webcam Selfie Biometric Check */}
          <button
            id="btn-hard-gate-selfie"
            type="button"
            onClick={() => setIsSelfieModalOpen(true)}
            className="w-full py-3 px-4 rounded-2xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Live Webcam Biometric Selfie Check</span>
          </button>

          {/* 3. Status Poll & Sign Out row */}
          <div className="flex items-center justify-between gap-3 pt-2">
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

      {/* Live Selfie Verification Modal */}
      <SelfieVerificationModal
        isOpen={isSelfieModalOpen}
        onClose={() => setIsSelfieModalOpen(false)}
        userId={currentProfile.id}
        onVerificationComplete={async () => {
          setIsSelfieModalOpen(false);
          await onRefreshProfile();
        }}
      />
    </div>
  );
};
