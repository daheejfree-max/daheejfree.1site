'use client';

// ==============================================================================
// GOOGLE FAST-TRACK ONBOARDING MODAL (10-SECOND DOWRY-FREE REGISTRATION)
// ==============================================================================

import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  X,
  Sparkles,
  ArrowRight,
  User,
  Heart,
  Scale,
  MapPin,
  Briefcase,
  Phone,
  Gavel,
  Shield,
  FileText,
} from 'lucide-react';
import { Gender } from '../../types/database';
import { registerWithGoogleFastTrack } from '../../lib/supabase/auth';
import { LegalPolicies, LegalPolicyTab } from '../legal/LegalPolicies';

interface GoogleFastRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser: {
    name: string;
    email: string;
    avatar_url?: string;
  } | null;
  onSuccess: (userId: string) => void;
}

export const GoogleFastRegisterModal: React.FC<GoogleFastRegisterModalProps> = ({
  isOpen,
  onClose,
  googleUser,
  onSuccess,
}) => {
  const [gender, setGender] = useState<Gender>('female');
  const [age, setAge] = useState<number>(24);
  const [location, setLocation] = useState<string>('');
  const [profession, setProfession] = useState<string>('');
  const [waliName, setWaliName] = useState<string>('');
  const [waliRelation, setWaliRelation] = useState<string>('Father');
  const [waliPhone, setWaliPhone] = useState<string>('');
  const [waliEmail, setWaliEmail] = useState<string>('');
  const [antiDowryPledge, setAntiDowryPledge] = useState<boolean>(true);
  const [legalConsent, setLegalConsent] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalPolicyTab | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !googleUser) return null;

  const handleAgeChange = (newAge: number) => {
    setAge(newAge);
    if (gender === 'male' && newAge < 21) {
      setAgeError('⚠️ Minimum age eligibility for grooms is 21 years.');
    } else if (gender === 'female' && newAge < 18) {
      setAgeError('⚠️ Minimum age eligibility for brides is 18 years.');
    } else {
      setAgeError(null);
    }
  };

  const handleGenderChange = (newGender: Gender) => {
    setGender(newGender);
    if (newGender === 'male' && age < 21) {
      setAgeError('⚠️ Minimum age eligibility for grooms is 21 years.');
    } else if (newGender === 'female' && age < 18) {
      setAgeError('⚠️ Minimum age eligibility for brides is 18 years.');
    } else {
      setAgeError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Age Eligibility Check
    if (gender === 'male' && age < 21) {
      const msg = '⚠️ Minimum age eligibility for grooms is 21 years.';
      setAgeError(msg);
      setErrorMsg(msg);
      return;
    }

    if (gender === 'female' && age < 18) {
      const msg = '⚠️ Minimum age eligibility for brides is 18 years.';
      setAgeError(msg);
      setErrorMsg(msg);
      return;
    }
    setAgeError(null);

    if (!antiDowryPledge) {
      setErrorMsg('You must agree to the Islamic Anti-Dowry (Bila-Daheej) Charter to complete registration.');
      return;
    }

    if (!legalConsent) {
      setErrorMsg('You must agree to the Terms of Service, Privacy Policy, and Third-Party KYC Disclaimer.');
      return;
    }

    setIsSubmitting(true);

    const res = await registerWithGoogleFastTrack({
      name: googleUser.name,
      email: googleUser.email,
      avatar_url: googleUser.avatar_url,
      gender,
      age,
      location,
      profession,
      waliName,
      waliRelation,
      waliPhone,
      waliEmail: waliEmail.trim() || googleUser.email,
      antiDowryPledge,
      legalConsentAcceptedAt: new Date().toISOString(),
    });

    setIsSubmitting(false);

    if (res.success && res.profile) {
      onSuccess(res.profile.id);
      onClose();
    } else {
      setErrorMsg(res.error || 'Fast registration failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Google User Header Card */}
        <div className="flex items-center gap-3.5 p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-emerald-500 flex-shrink-0">
            {googleUser.avatar_url ? (
              <img
                src={googleUser.avatar_url}
                alt={googleUser.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center font-bold text-emerald-800 dark:text-emerald-300">
                {googleUser.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-extrabold truncate text-zinc-900 dark:text-white">
                {googleUser.name}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-700">
                Google Verified
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{googleUser.email}</p>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>Fast-Track Nikah Profile Setup</span>
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Complete your profile in 10 seconds with Shariah anti-dowry protections.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Candidate Role & Age */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Candidate Role
                </label>
                <select
                  value={gender}
                  onChange={(e) => handleGenderChange(e.target.value as Gender)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="female">Sister (Bride)</option>
                  <option value="male">Brother (Groom)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  min={gender === 'male' ? 21 : 18}
                  max={75}
                  required
                  value={age}
                  onChange={(e) => handleAgeChange(Number(e.target.value))}
                  className={`w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-xl border transition-colors ${
                    ageError
                      ? 'border-red-500 focus:border-red-600'
                      : 'border-zinc-300 dark:border-zinc-700 focus:outline-none focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>
            {ageError && (
              <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-[11px] text-red-700 dark:text-red-300 font-semibold flex items-center gap-1.5">
                <span>{ageError}</span>
              </div>
            )}
          </div>

          {/* Location & Profession */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                City, State
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Hyderabad, TS"
                className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Profession
              </label>
              <input
                type="text"
                required
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="e.g. Software Engineer"
                className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Guardian (Wali) Details */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <h4 className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Wali (Guardian) Contact
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={waliName}
                onChange={(e) => setWaliName(e.target.value)}
                placeholder="Guardian Full Name"
                className="w-full bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
              />
              <select
                value={waliRelation}
                onChange={(e) => setWaliRelation(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
              >
                <option value="Father">Father</option>
                <option value="Brother">Brother</option>
                <option value="Uncle">Uncle</option>
                <option value="Self / Legal Guardian">Self / Legal Guardian</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="tel"
                required
                value={waliPhone}
                onChange={(e) => setWaliPhone(e.target.value)}
                placeholder="Guardian Phone (+91 ...)"
                className="w-full bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
              />
              <input
                type="email"
                required
                value={waliEmail}
                onChange={(e) => setWaliEmail(e.target.value)}
                placeholder="Guardian Email (wali@domain.com)"
                className="w-full bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
              />
            </div>
          </div>

          {/* Solemn Anti-Dowry Charter Checkbox */}
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-300 dark:border-emerald-700/60 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="google-fast-pledge"
              checked={antiDowryPledge}
              onChange={(e) => setAntiDowryPledge(e.target.checked)}
              className="mt-0.5 accent-emerald-600 w-4 h-4 rounded cursor-pointer"
              required
            />
            <label htmlFor="google-fast-pledge" className="text-xs text-emerald-900 dark:text-emerald-200 leading-snug cursor-pointer">
              <strong>Solemn Shariah Pledge:</strong> I solemnly declare under Allah that I will not demand, accept, or facilitate any dowry (Daheej) in any form for this Nikah.
            </label>
          </div>

          {/* PROMINENT ZERO-LIABILITY LEGAL WAIVER & PLATFORM DISCLAIMER */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/60 space-y-2 text-xs text-zinc-800 dark:text-zinc-200">
            <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-extrabold text-[11px] uppercase tracking-wider">
              <Gavel className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Zero-Liability & Intermediary Disclaimer</span>
            </div>
            <p className="text-[10.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              <strong>Technical Intermediary:</strong> DaheejFree operates under <strong>Section 79 of the IT Act, 2000</strong>. The platform and its operators bear <strong>ZERO LIABILITY</strong> for user veracity, offline meetings, marriage outcomes, or financial transactions. Walis & candidates must perform all due diligence.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200 dark:border-amber-800/60 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400">
              <button
                type="button"
                onClick={() => setLegalModalTab('terms')}
                className="hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                Terms of Service
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setLegalModalTab('privacy')}
                className="hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Shield className="w-3 h-3" />
                Privacy Policy
              </button>
            </div>
          </div>

          {/* Mandatory Legal & Third-Party KYC Disclaimer Checkbox */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-300 dark:border-zinc-800 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="google-legal-consent"
              checked={legalConsent}
              onChange={(e) => setLegalConsent(e.target.checked)}
              className="mt-1 accent-emerald-600 w-4 h-4 rounded cursor-pointer shrink-0"
              required
            />
            <label htmlFor="google-legal-consent" className="text-xs text-zinc-800 dark:text-zinc-200 leading-snug cursor-pointer">
              <strong>I agree to the Terms of Service, Privacy Policy, and Zero-Liability Platform Disclaimer.</strong> I explicitly acknowledge and agree that DaheejFree is not responsible or liable for any user behavior, background verification, offline meetings, or marriage decisions.
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !legalConsent}
            className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
              !legalConsent
                ? 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed opacity-50 shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-700/20 dark:shadow-emerald-950 hover:scale-[1.01] cursor-pointer'
            }`}
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Complete Instant Registration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Inline Legal Policies Modal */}
        {legalModalTab && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-y-auto space-y-4 text-zinc-900 dark:text-white">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  <span>Terms of Service & Legal Disclaimer</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLegalModalTab(null)}
                  className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-600 dark:text-zinc-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <LegalPolicies initialTab={legalModalTab} onBack={() => setLegalModalTab(null)} />
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setLegalConsent(true);
                    setLegalModalTab(null);
                  }}
                  className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  I Agree to Terms
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleFastRegisterModal;
