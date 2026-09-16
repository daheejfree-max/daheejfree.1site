'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  HeartHandshake,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Lock,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { Profile } from '../../types';
import { supabase, daheejStore } from '../../lib/supabase/client';

interface IslamicOathModalProps {
  isOpen: boolean;
  onAccept?: () => void;
  onOathSigned?: () => void;
  onDecline?: () => void;
  onClose?: () => void;
  userName?: string;
  currentProfile?: Profile | null;
}

export const IslamicOathModal: React.FC<IslamicOathModalProps> = ({
  isOpen,
  onAccept,
  onOathSigned,
  onDecline,
  onClose,
  userName,
  currentProfile,
}) => {
  const [pledges, setPledges] = useState({
    antiDowry: false,
    waliOversight: false,
    chastityModesty: false,
    truthfulness: false,
    safetyAndTerms: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  if (!isOpen) return null;

  const allChecked =
    pledges.antiDowry &&
    pledges.waliOversight &&
    pledges.chastityModesty &&
    pledges.truthfulness &&
    pledges.safetyAndTerms;

  const effectiveUserName =
    userName ||
    currentProfile?.nickname ||
    currentProfile?.full_name ||
    'Prospective Member';

  const handleSelectAll = () => {
    const nextState = !allChecked;
    setPledges({
      antiDowry: nextState,
      waliOversight: nextState,
      chastityModesty: nextState,
      truthfulness: nextState,
      safetyAndTerms: nextState,
    });
    if (validationError) setValidationError(null);
  };

  const handleDismiss = () => {
    if (onClose) {
      onClose();
    } else if (onDecline) {
      onDecline();
    }
  };

  const handleSignCovenant = async () => {
    if (!allChecked) {
      setValidationError('Please review and check all 5 foundational safety covenants & policies below to continue.');
      return;
    }

    setValidationError(null);
    setIsLoading(true);

    try {
      // 1. Attempt to get authenticated user or fallback to currentProfile id
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = user?.id || currentProfile?.id;

      if (targetUserId) {
        const { error } = await supabase
          .from('profiles')
          .update({
            covenant_signed: true,
            covenant_signed_at: new Date().toISOString(),
            islamic_oath_signed: true,
            islamic_oath_date: new Date().toISOString(),
            anti_dowry_pledged: true,
            terms_accepted: true,
            privacy_policy_accepted: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetUserId);

        if (error) {
          console.warn('Could not update Supabase profiles (column may be missing). Saving to fallback:', error);
        }

        // Also update local mock store
        try {
          daheejStore.updateProfile(targetUserId, {
            covenant_signed: true,
            covenant_signed_at: new Date().toISOString(),
            islamic_oath_signed: true,
            anti_dowry_pledged: true,
            terms_accepted: true,
            privacy_policy_accepted: true,
          });
        } catch (storeErr) {
          // ignore store error
        }
      }
    } catch (err) {
      console.warn('Auth/DB error during covenant signing:', err);
    } finally {
      // Always set local storage fallback so user state is reliably preserved
      try {
        localStorage.setItem('covenant_signed', 'true');
        localStorage.setItem('islamic_oath_signed', 'true');
        localStorage.setItem('policies_accepted', 'true');
        if (currentProfile?.id) {
          localStorage.setItem(`covenant_${currentProfile.id}`, 'true');
        }
      } catch (storageErr) {
        console.warn('LocalStorage error:', storageErr);
      }

      setIsLoading(false);

      // Trigger success callbacks
      if (onOathSigned) onOathSigned();
      if (onAccept) onAccept();

      // Dismiss modal immediately
      handleDismiss();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-emerald-500/30 dark:border-emerald-600/30 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header with Islamic Safety Emblem */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white p-5 sm:p-6 text-center relative flex-shrink-0">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-3 shadow-inner">
            <Scale className="w-6 h-6 text-emerald-300" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/40 text-[10px] sm:text-[11px] font-bold text-emerald-200 uppercase tracking-wider mb-2">
            Mandatory Safety & Shariah Policies
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            Islamic Oath, Anti-Dowry & Safety Policies
          </h2>
          <p className="text-xs text-emerald-200/90 mt-1 max-w-md mx-auto">
            To ensure a 100% safe, scam-free, and halal environment for all sisters and brothers, every member must agree to our safety policies before continuing.
          </p>
        </div>

        {/* Scrollable Covenant Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 text-sm text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 flex-grow">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
              <p className="text-[11px] leading-relaxed">
                "And fulfill every covenant. Verily! the covenant will be questioned about." (Surah Al-Isra 17:34)
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Welcome, <strong>{effectiveUserName}</strong>. Please agree to all policies below:
            </p>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{allChecked ? 'Deselect All' : 'Select All Policies'}</span>
            </button>
          </div>

          {validationError && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Oath Clauses Checkboxes */}
          <div className="space-y-2.5">
            {/* Clause 1: Anti-Dowry */}
            <label
              className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors cursor-pointer ${
                !pledges.antiDowry && validationError
                  ? 'border-red-400 bg-red-50/40 dark:bg-red-950/20'
                  : pledges.antiDowry
                  ? 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/30'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40 bg-zinc-50/50 dark:bg-zinc-950/50'
              }`}
            >
              <input
                type="checkbox"
                checked={pledges.antiDowry}
                onChange={(e) => {
                  setPledges({ ...pledges, antiDowry: e.target.checked });
                  if (validationError) setValidationError(null);
                }}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  100% Zero-Dowry (Daheej/Jahez) Covenant
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  I solemnly pledge never to demand, solicit, negotiate, or accept dowry (cash, luxury gifts, appliances, cars, or jewelry demands). I honor the Prophet's Sunnah of a pure, simple Nikah and legitimate Mahr.
                </p>
              </div>
            </label>

            {/* Clause 2: Wali Oversight */}
            <label
              className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors cursor-pointer ${
                !pledges.waliOversight && validationError
                  ? 'border-red-400 bg-red-50/40 dark:bg-red-950/20'
                  : pledges.waliOversight
                  ? 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/30'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40 bg-zinc-50/50 dark:bg-zinc-950/50'
              }`}
            >
              <input
                type="checkbox"
                checked={pledges.waliOversight}
                onChange={(e) => {
                  setPledges({ ...pledges, waliOversight: e.target.checked });
                  if (validationError) setValidationError(null);
                }}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Wali (Guardian) Oversight & Pure Marriage Intent
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  I confirm that my sole purpose is serious matrimonial Nikah. I agree to involve a Wali (Guardian) or family member, and strictly avoid casual dating, flirting, or non-matrimonial interactions.
                </p>
              </div>
            </label>

            {/* Clause 3: Privacy & Photo Protection */}
            <label
              className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors cursor-pointer ${
                !pledges.chastityModesty && validationError
                  ? 'border-red-400 bg-red-50/40 dark:bg-red-950/20'
                  : pledges.chastityModesty
                  ? 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/30'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40 bg-zinc-50/50 dark:bg-zinc-950/50'
              }`}
            >
              <input
                type="checkbox"
                checked={pledges.chastityModesty}
                onChange={(e) => {
                  setPledges({ ...pledges, chastityModesty: e.target.checked });
                  if (validationError) setValidationError(null);
                }}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Privacy, Anti-Screenshot & Haya Protection
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  I will protect member confidentiality. I will never screenshot, record, share, or misuse private photos or contact details. I will communicate with Islamic modesty (Haya).
                </p>
              </div>
            </label>

            {/* Clause 4: Truthfulness */}
            <label
              className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors cursor-pointer ${
                !pledges.truthfulness && validationError
                  ? 'border-red-400 bg-red-50/40 dark:bg-red-950/20'
                  : pledges.truthfulness
                  ? 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/30'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40 bg-zinc-50/50 dark:bg-zinc-950/50'
              }`}
            >
              <input
                type="checkbox"
                checked={pledges.truthfulness}
                onChange={(e) => {
                  setPledges({ ...pledges, truthfulness: e.target.checked });
                  if (validationError) setValidationError(null);
                }}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Truthfulness in Profile, Age & Marital Status
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  I swear before Allah (SWT) that all information provided regarding my identity, age, marital status, education, profession, and family background is 100% accurate and truthful.
                </p>
              </div>
            </label>

            {/* Clause 5: Terms of Service & Safety Guidelines */}
            <label
              className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors cursor-pointer ${
                !pledges.safetyAndTerms && validationError
                  ? 'border-red-400 bg-red-50/40 dark:bg-red-950/20'
                  : pledges.safetyAndTerms
                  ? 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/30'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40 bg-zinc-50/50 dark:bg-zinc-950/50'
              }`}
            >
              <input
                type="checkbox"
                checked={pledges.safetyAndTerms}
                onChange={(e) => {
                  setPledges({ ...pledges, safetyAndTerms: e.target.checked });
                  if (validationError) setValidationError(null);
                }}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Terms of Service, Privacy Policy & Anti-Extortion Rules
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  I accept the platform's <span className="text-emerald-600 dark:text-emerald-400 font-semibold underline">Terms of Service</span>, <span className="text-emerald-600 dark:text-emerald-400 font-semibold underline">Privacy Policy</span>, and Zero-Tolerance Safety Rules. I acknowledge that extortion, harassment, or fraudulent profiles will result in immediate permanent ban and law enforcement reporting.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 bg-zinc-50 dark:bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              disabled={isLoading}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline cursor-pointer p-1"
            >
              Decline & Exit
            </button>
            <span className="text-[11px] text-zinc-400">
              {allChecked ? '5 of 5 policies agreed' : `${Object.values(pledges).filter(Boolean).length} of 5 policies agreed`}
            </span>
          </div>

          <button
            id="btn-sign-islamic-oath"
            type="button"
            disabled={isLoading}
            onClick={handleSignCovenant}
            className={`w-full sm:w-auto py-3 px-6 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
              allChecked && !isLoading
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Signing Covenants...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>I Swear by Allah & Accept All Policies</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Exit Platform Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[10000] bg-zinc-950/90 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 mx-auto flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Policy Acceptance Required
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              To protect all members from dowry demands, fake profiles, and harassment, agreeing to our Shariah & Safety policies is mandatory. Declining will return you to the home page.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition cursor-pointer"
              >
                Review Policies
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  handleDismiss();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                Exit to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
