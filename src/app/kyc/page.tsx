'use client';

// ==============================================================================
// DIDIT-EXCLUSIVE KYC VERIFICATION PORTAL
// File: src/app/kyc/page.tsx
// Pure Didit Webhook-Driven KYC Workflow.
// Contains ONLY the KycVerifyButton that initiates the Didit webhook session.
// All manual document upload elements (<input type="file">) are strictly excluded.
// ==============================================================================

import React, { useEffect, useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { Logo } from '../../components/brand/Logo';
import { KycVerifyButton } from '../../components/KycVerifyButton';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase/client';

export default function KycPage() {
  const { profile, user, refreshState } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isVerified = Boolean(
    profile?.kyc_verified === true ||
    profile?.kyc_status === 'verified' ||
    profile?.is_verified === true
  );

  const activeUserId = profile?.id || user?.id || '';

  const handleRefreshStatus = async () => {
    if (!activeUserId) return;
    setIsRefreshing(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      // Query profiles table directly to check if Didit Webhook has updated verification status
      const { data, error } = await supabase
        .from('profiles')
        .select('kyc_verified, kyc_status, is_verified, updated_at')
        .eq('id', activeUserId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      await refreshState();

      if (data?.kyc_verified || data?.kyc_status === 'verified') {
        setStatusMessage('Alhamdulillah! Your identity has been verified via Didit.');
      } else {
        setStatusMessage(
          `Current KYC Status: ${(data?.kyc_status || 'pending').toUpperCase()}. Once completed on Didit, the secure webhook will automatically verify your account.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to check verification status right now.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-xl mx-auto w-full space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <a
            href="/profile"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Profile</span>
          </a>
          <Logo size="sm" />
        </div>

        {/* Verification Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl space-y-6">
          {/* Header Badge */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-600/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Didit Identity Verification
              </h1>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Official biometric and government identity verification for DaheejFree members
              </p>
            </div>
          </div>

          {/* Verification Status Banner */}
          {isVerified ? (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                  Identity Verified via Didit Protocol
                </p>
                <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">
                  Your government document and facial biometric liveness check are verified. Your profile displays the verified shield badge across the entire platform.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                  Verification Required
                </p>
                <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">
                  To safeguard all marriage candidates and eliminate fake profiles, government ID and liveness checks are required via Didit.
                </p>
              </div>
            </div>
          )}

          {/* Privacy & Protocol Guarantees */}
          <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[11px]">
              <Lock className="w-3.5 h-3.5" />
              <span>Decentralized & Zero Raw Document Storage</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>No sensitive document images or Aadhaar/Passport copies are stored on our servers.</li>
              <li>Verification is executed cryptographically through Didit's secure biometric enclave.</li>
              <li>Approval is confirmed exclusively through Didit's authenticated server webhook.</li>
            </ul>
          </div>

          {/* Status / Error Alerts */}
          {statusMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Triggers: Exclusive KycVerifyButton */}
          <div className="space-y-3 pt-2">
            {!isVerified && (
              <KycVerifyButton
                id="btn-kyc-page-verify"
                userId={activeUserId}
                profileId={activeUserId}
                className="w-full py-3.5 px-6 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                onError={(err) => setErrorMessage(err)}
              >
                <ShieldCheck className="w-5 h-5 text-white" />
                <span>Verify with Didit</span>
              </KycVerifyButton>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                id="btn-kyc-page-refresh"
                type="button"
                onClick={handleRefreshStatus}
                disabled={isRefreshing}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Check Webhook Status</span>
              </button>

              <a
                href="/matches"
                className="py-2.5 px-4 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Browse Matches &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
