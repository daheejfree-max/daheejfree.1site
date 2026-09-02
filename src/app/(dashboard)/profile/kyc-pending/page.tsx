'use client';

// ==============================================================================
// PENDING KYC HOLDING PAGE: AUTOMATED DIDIT IDENTITY PROTOCOL & BOT-FREE SECURE WALL
// ==============================================================================

import React from 'react';
import { ShieldCheck, Clock, CheckCircle2, Lock, ArrowLeft, Mail } from 'lucide-react';
import { Logo } from '../../../../components/brand/Logo';
import { useAuth } from '../../../../hooks/useAuth';

export default function KYCPendingPage() {
  const { profile } = useAuth();

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 text-center space-y-6 transition-colors duration-200">
      <div className="flex justify-center">
        <Logo size="lg" />
      </div>

      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/50 flex items-center justify-center shadow-xl shadow-blue-500/10 dark:shadow-blue-950/60 animate-pulse">
          <Clock className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <div className="space-y-3 max-w-md mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <span>Automated Didit Verification in Progress</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
          Account Under Didit KYC Verification
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Your account is undergoing automated identity verification. To maintain a 100% authentic, bot-free, and secure Islamic environment, Didit cryptographically verifies your identity to prevent fake profiles.
        </p>
      </div>

      {/* Feature Guarantee Grid */}
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-left space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300 shadow-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>Identity cryptographically verified via the Didit protocol</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>Encrypted biometric isolation with zero third-party disclosure</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>Strict zero-dowry charter and modesty enforcement</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <a
          href="/profile"
          className="py-3 px-6 rounded-2xl text-xs font-bold bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800 flex items-center gap-2 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Review My Profile</span>
        </a>

        <a
          href="mailto:support@daheejfree.com"
          className="py-3 px-6 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-600/20 dark:shadow-emerald-950 transition-all hover:scale-105"
        >
          <Mail className="w-4 h-4" />
          <span>Contact Support Team</span>
        </a>
      </div>
    </div>
  );
}

