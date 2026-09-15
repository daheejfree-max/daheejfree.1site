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
import { Profile } from '../../types/database';
import { daheejStore } from '../../lib/supabase/store';
import { supabase } from '../../lib/supabase/client';

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isSelfieVerified = Boolean(currentProfile.selfie_verified);
  const isDocVerified = Boolean(currentProfile.kyc_document_url || currentProfile.kyc_status === 'verified');

  // Initiate real Didit.me Government ID & Biometric Verification Session
  const handleStartDiditSession = async () => {
    setIsStartingDidit(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/kyc/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentProfile.id,
          profileId: currentProfile.id,
          returnUrl: window.location.href,
        }),
      });

      let data: any = null;
      try {
        const responseText = await response.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        console.warn('[HardKYCGate] Non-JSON response received from create-session endpoint');
      }

      const sessionUrl = data?.url || data?.sessionUrl || data?.session_url || data?.verification_url;
      const sessionId = data?.sessionId || data?.session_id;

      if (sessionUrl) {
        if (onUpdateProfile) {
          onUpdateProfile({
            kyc_session_id: sessionId,
            didit_session_url: sessionUrl,
            kyc_status: 'pending',
          });
        }
        daheejStore.updateProfile(currentProfile.id, {
          kyc_session_id: sessionId,
          didit_session_url: sessionUrl,
          kyc_status: 'pending',
        });

        // Launch Didit.me verification window
        setStatusMessage('Redirecting to Didit Identity Gateway...');
        window.location.href = sessionUrl;
      } else {
        setError(data?.error || data?.message || 'Failed to initiate Didit session. Please try again later.');
      }
    } catch (err: any) {
      console.error('[HardKYCGate] Didit session initialization error:', err);
      setError(err.message || 'Unable to connect to Didit gateway. Please check your network or server configuration.');
    } finally {
      setIsStartingDidit(false);
    }
  };

  // Poll / Refresh verification status from backend & database (direct public.profiles query)
  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    setError(null);
    setStatusMessage(null);

    try {
      const { data, error: dbErr } = await supabase
        .from('profiles')
        .select('kyc_verified, kyc_status, id_verified, selfie_verified, is_verified')
        .eq('id', currentProfile.id)
        .single();

      if (dbErr) {
        console.warn('[HardKYCGate] Profile query warning:', dbErr);
      }

      const isVerified =
        data?.kyc_verified === true ||
        data?.kyc_status === 'verified' ||
        data?.is_verified === true;

      if (isVerified) {
        daheejStore.updateProfile(currentProfile.id, {
          kyc_status: 'verified',
          kyc_verified: true,
          is_verified: true,
          id_verified: true,
          selfie_verified: true,
        });
        if (onUpdateProfile) {
          onUpdateProfile({
            kyc_status: 'verified',
            kyc_verified: true,
            is_verified: true,
            id_verified: true,
            selfie_verified: true,
          });
        }
        setStatusMessage('Identity successfully verified. Redirecting to platform...');
        await onRefreshProfile();
        return;
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

        {/* Dynamic Alerts */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2 text-left animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">{error}</p>
              <p className="text-[11px] text-rose-400">
                Please ensure you complete the official Didit hosted verification link on your smartphone or browser.
              </p>
            </div>
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
          {/* Primary Action Button: Start Government ID Verification */}
          <button
            id="btn-hard-gate-didit"
            type="button"
            onClick={handleStartDiditSession}
            disabled={isStartingDidit}
            className="w-full py-4 px-4 rounded-2xl text-sm sm:text-base font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-5 h-5 text-white" />
            <span>{isStartingDidit ? 'Connecting to Identity Gateway...' : 'Start Government ID Verification'}</span>
            <ExternalLink className="w-4 h-4 opacity-80" />
          </button>

          {/* Status Poll & Sign Out row */}
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
    </div>
  );
};
