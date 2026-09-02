'use client';

// ==============================================================================
// DAHEEJFREE - VERIFICATION, SAFETY & THIRD-PARTY KYC DISCLAIMER
// ==============================================================================

import React from 'react';
import { AlertOctagon, ShieldAlert, CheckCircle, Users, Scale, HeartHandshake, Eye, ArrowLeft, PhoneCall } from 'lucide-react';
import { useRouter } from '../../hooks/useRouter';

interface LegalPageProps {
  onBack?: () => void;
}

export default function VerificationDisclaimerPage({ onBack }: LegalPageProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation & Header */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 mb-4 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Platform</span>
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-600/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Verification & Safety Disclaimer
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Third-Party KYC Limitations, Due Diligence Mandate & Matrimonial Safety Protocol
              </p>
            </div>
          </div>
        </div>

        {/* High-Alert Header Box */}
        <div className="p-5 sm:p-6 rounded-3xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 mb-8 space-y-3">
          <div className="flex items-center gap-2 text-red-900 dark:text-red-200 font-black text-sm uppercase">
            <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span>CRITICAL NOTICE: VERIFIED BADGES DO NOT GUARANTEE USER IDENTITY OR CHARACTER</span>
          </div>
          <p className="text-xs sm:text-sm text-red-800 dark:text-red-300 leading-relaxed">
            DaheejFree is an online communication platform and technology intermediary. We do NOT conduct police background checks, physical home visits, or character investigations. You and your Wali must perform strict offline due diligence before proceeding with marriage.
          </p>
        </div>

        {/* Main Disclaimer Body */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-xs sm:text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          
          {/* Section 1: Third Party Didit KYC Gating */}
          <section className="space-y-3 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-center font-black">1</span>
              Third-Party KYC ("Didit") Technical Limitations
            </h2>
            <p>
              DaheejFree integrates with <strong>Didit Identity Services ("Didit")</strong>, an independent third-party identity verification provider.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Intermediary Only:</strong> DaheejFree only receives automated verification status signals from Didit’s API. We do not independently verify, review, or certify physical identity documents or public records.
              </li>
              <li>
                <strong>No Guarantee of Accuracy:</strong> Automated OCR and facial biometric algorithms may be vulnerable to sophisticated manipulation, impersonation, synthetic media (deepfakes), or forged government documents.
              </li>
              <li>
                <strong>Zero Liability for Platform:</strong> DaheejFree and its founders assume <strong>ABSOLUTELY ZERO LIABILITY</strong> for any fraud, misrepresentation, synthetic profile, or identity theft perpetrated by users circumventing verification systems.
              </li>
            </ul>
          </section>

          {/* Section 2: What a "Verified" Badge Means */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-center font-black">2</span>
              What "Verified" Does & Does NOT Mean
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Green: What it does mean */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>WHAT A BADGE MEANS:</span>
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                  • An identity document was submitted to Didit.<br />
                  • The user signed the electronic Anti-Dowry Shariah pledge.<br />
                  • Basic automated liveness check was completed.
                </p>
              </div>

              {/* Red: What it DOES NOT mean */}
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 space-y-2">
                <div className="flex items-center gap-1.5 text-red-800 dark:text-red-300 font-bold text-xs">
                  <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>WHAT IT DOES NOT MEAN:</span>
                </div>
                <p className="text-[11px] text-red-700 dark:text-red-300/90 leading-relaxed">
                  • Does NOT guarantee moral character or piety.<br />
                  • Does NOT verify criminal history or marital status.<br />
                  • Does NOT verify employment, salary, or assets.<br />
                  • Does NOT guarantee offline safety or behavior.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Mandatory Due Diligence Checklist */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-center font-black">3</span>
              Mandatory Islamic & Offline Due Diligence Protocol
            </h2>
            <p>
              Prior to solemnizing Nikah, exchanging gifts, or making life-altering commitments, you and your family are legally and religiously required to perform comprehensive due diligence:
            </p>
            <div className="space-y-2 pl-4 border-l-2 border-amber-500/50 text-xs">
              <p>
                <strong>1. Wali Supervision:</strong> Never engage in private, isolated conversations without the knowledge and active involvement of the bride's legitimate Islamic guardian (Wali).
              </p>
              <p>
                <strong>2. Community References:</strong> Contact the local Masjid Imam, workplace colleagues, relatives, and neighbors to verify candidate reputation, temperament, and family background.
              </p>
              <p>
                <strong>3. Public Family Meetings:</strong> All initial physical meetings must occur in safe, public, or family home settings accompanied by Walis and guardians. Never meet alone in isolated locations.
              </p>
              <p>
                <strong>4. Zero Financial Transfers:</strong> NEVER send money, wire transfers, crypto, or gift deposits to any individual claiming financial emergency, travel costs, or medical distress. Report any solicitation immediately.
              </p>
            </div>
          </section>

          {/* Section 4: Offline Extortion & Dowry Indemnity */}
          <section className="space-y-3 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-center font-black">4</span>
              Zero Liability for Offline Extortion, Dowry, or Marital Disputes
            </h2>
            <p>
              While DaheejFree vigorously champions dowry-free marriages, the platform cannot police offline conversations, secret demands, or private family negotiations.
            </p>
            <p>
              DaheejFree, its directors, and technical operators hold <strong>ZERO LIABILITY</strong> for any financial extortion, wedding cancellations, emotional distress, physical violence, or legal disputes occurring between families offline.
            </p>
          </section>

          {/* Section 5: Emergency Support & Reporting */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-center font-black">5</span>
              Immediate Reporting of Violations
            </h2>
            <p>
              If any user demands dowry (Daheej), engages in harassment, makes financial solicitations, or behaves inappropriately, report their profile immediately through the in-app reporting button or contact our compliance board. We act swiftly to ban violators.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
