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
  });

  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  if (!isOpen) return null;

  const allChecked =
    pledges.antiDowry &&
    pledges.waliOversight &&
    pledges.chastityModesty &&
    pledges.truthfulness;

  const effectiveUserName =
    userName ||
    currentProfile?.nickname ||
    currentProfile?.full_name ||
    'Prospective Member';

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setHasScrolledToBottom(true);
    }
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
      setValidationError('Please review and check all 4 covenant pledges below before swearing and signing.');
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
          })
          .eq('id', targetUserId);

        if (error) {
          console.warn('Could not update Supabase profiles (column may be missing). Saving to fallback:', error);
        }

        // Also update local mock store if active
        try {
          daheejStore.updateProfile(targetUserId, {
            covenant_signed: true,
            covenant_signed_at: new Date().toISOString(),
            islamic_oath_signed: true,
            anti_dowry_pledged: true,
          });
        } catch (storeErr) {
          // ignore store error
        }
      }
    } catch (err) {
      console.warn('Auth/DB error during covenant signing:', err);
    } finally {
      // Always set local storage fallback so user is never trapped
      try {
        localStorage.setItem('covenant_signed', 'true');
        localStorage.setItem('islamic_oath_signed', 'true');
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
    <div className="fixed inset-0 z-[9999] bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-emerald-500/30 dark:border-emerald-600/30 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header with Islamic Emblem */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 text-center relative flex-shrink-0">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-3 shadow-inner">
            <Scale className="w-6 h-6 text-emerald-300" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/40 text-[11px] font-semibold text-emerald-200 uppercase tracking-wider mb-2">
            Mandatory Guardrail
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Islamic Oath & Anti-Dowry Covenant
          </h2>
          <p className="text-xs text-emerald-200/90 mt-1 max-w-md mx-auto">
            DaheejFree operates strictly for sincere Islamic Nikah, upholding the Sunnah of modesty, zero-dowry, and Wali oversight.
          </p>
        </div>

        {/* Scrollable Covenant Content */}
        <div
          onScroll={handleScroll}
          className="p-6 overflow-y-auto space-y-4 text-sm text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 flex-grow"
        >
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
              <p className="text-[11px] leading-relaxed">
                "And fulfill every covenant. Verily! the covenant will be questioned about." (Surah Al-Isra 17:34)
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Before proceeding as <strong>{effectiveUserName}</strong>, you must swear by Allah (SWT) to adhere to these foundational Islamic covenants:
          </p>

          {validationError && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Oath Clauses Checkboxes */}
          <div className="space-y-3 pt-2">
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
                  100% Zero-Dowry (Daheej/Jahez) Pledge
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                  I solemnly pledge never to demand, solicit, negotiate, or accept dowry (cash, luxury cars, electronics, gold demands). I honor the Islamic Sunnah of a simple Nikah and legitimate Mahr.
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
                  Wali-Supervised Marriage Intent
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                  I confirm that my sole purpose is solemn matrimonial Nikah. I agree to involve a Wali (Guardian) or family member, and avoid casual dating, flirting, or illicit conduct.
                </p>
              </div>
            </label>

            {/* Clause 3: Chastity & Modesty */}
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
                  Privacy, Haya & Anti-Harassment
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                  I will respect everyone's privacy and photos. I will not screenshot, distribute, or misuse profile materials. I will communicate with pure Islamic manners and Haya.
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
                  Truthfulness in Profile & Identity
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                  I swear before Allah (SWT) that all information provided regarding my religious practice, marital status, profession, and family background is 100% truthful and verified.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-5 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-4 flex-shrink-0">
          {(onDecline || onClose) && (
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Exit Platform
            </button>
          )}

          <button
            id="btn-sign-islamic-oath"
            type="button"
            disabled={isLoading}
            onClick={handleSignCovenant}
            className={`flex-1 py-3 px-5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
              allChecked && !isLoading
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-emerald-800/40 dark:bg-emerald-950 text-emerald-200 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-700/50'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Signing Covenant...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>I Swear by Allah & Sign Islamic Covenant</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
