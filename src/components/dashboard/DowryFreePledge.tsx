'use client';

// ==============================================================================
// SOLEMN ANTI-DOWRY (BILA-DAHEEJ) ISLAMIC CHARTER & REGISTRY
// ==============================================================================

import React, { useState } from 'react';
import {
  Shield,
  HeartHandshake,
  CheckCircle,
  FileCheck,
  Scale,
  Award,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Profile } from '../../types';

interface DowryFreePledgeProps {
  currentProfile: Profile | null;
  onSignPledge: () => void;
}

export const DowryFreePledge: React.FC<DowryFreePledgeProps> = ({
  currentProfile,
  onSignPledge,
}) => {
  const [pledged, setPledged] = useState(Boolean(currentProfile?.anti_dowry_pledged));

  const handlePledge = () => {
    setPledged(true);
    onSignPledge();
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
      });
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Hero Pledge Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-900 border-2 border-emerald-500/50 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-600/30 border border-emerald-400/60 flex items-center justify-center text-emerald-400 mb-4 shadow-lg">
          <Scale className="w-8 h-8" />
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider mb-2 inline-block">
          The Islamic Anti-Dowry Charter
        </span>

        <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
          Solemn Commitment to a 100% Dowry-Free Nikah
        </h2>

        <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl mx-auto leading-relaxed mb-6">
          "The best of marriages is the one which is the easiest and involves the least financial burden." (Abu Dawood). In accordance with the pure Sunnah of Prophet Muhammad (ﷺ), we eradicate un-Islamic cultural dowry demands, jahez gifts extortion, and social pressure.
        </p>

        {pledged ? (
          <div className="inline-flex items-center gap-2 bg-emerald-900/90 border border-emerald-400 px-5 py-2.5 rounded-2xl text-emerald-200 font-bold text-sm shadow-xl">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span>Pledged & Certified: Zero Dowry Advocate</span>
          </div>
        ) : (
          <button
            id="btn-sign-pledge"
            onClick={handlePledge}
            className="px-8 py-3 rounded-2xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-xl shadow-emerald-950 transition-transform hover:scale-105 flex items-center gap-2 mx-auto"
          >
            <Award className="w-5 h-5" />
            Sign the Anti-Dowry Pledge (Digital Signature)
          </button>
        )}
      </div>

      {/* 4 Pillars of Sunnah Nikah */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-2 shadow-sm dark:shadow-md transition-colors">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-600/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 mb-3 shadow-sm">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">1. Mahr Only (No Groom-Side Demands)</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Mahr is the exclusive Quranic gift directly from the groom to the bride. Demanding cars, appliances, furniture, cash, or gold from the bride's father is strictly prohibited and un-Islamic.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-2 shadow-sm dark:shadow-md transition-colors">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-600/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 mb-3 shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">2. Wali (Guardian) Dignity & Protection</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Guardians are contacted with utmost honor. Our platform strictly bans intermediaries who negotiate commercial deals around marriage.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-2 shadow-sm dark:shadow-md transition-colors">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-600/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 mb-3 shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">3. Walima Simplicity</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Encouraging simple, joyful wedding celebrations without lavish waste, debts, or competitive consumerism that burdens young families.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-2 shadow-sm dark:shadow-md transition-colors">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-600/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 mb-3 shadow-sm">
            <FileCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">4. Transparent Digital Registry</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Every verified profile displays their Anti-Dowry pledge badge, assuring prospective brides and grooms of pure intentions.
          </p>
        </div>
      </div>
    </div>
  );
};
