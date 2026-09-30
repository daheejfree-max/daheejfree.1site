'use client';

// ==============================================================================
// FOOTER WITH SOLEMN ANTI-DOWRY ISLAMIC PLEDGE & LEGAL POLICIES
// ==============================================================================

import React from 'react';
import { Shield, Heart, Scale, Lock, FileText, ShieldAlert, CheckCircle2, Globe, Smartphone } from 'lucide-react';
import { LanguageSelector } from '../common/LanguageSelector';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface FooterProps {
  onNavigate?: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const handleNav = (tab: string, e: React.MouseEvent) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(tab);
    }
  };

  return (
    <footer className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 text-sm mt-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Brand & Mission */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                <Heart className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg text-zinc-900 dark:text-white">
                Daheej<span className="text-emerald-600 dark:text-emerald-400">Free</span>
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md leading-relaxed">
              DaheejFree is a Shariah-compliant, privacy-first matrimonial initiative dedicated to eradicating the harmful cultural practice of dowry (Daheej/Jahez) and fostering righteous, dignified Sunnah marriages.
            </p>
            <div className="flex flex-wrap gap-2 text-xs pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-zinc-900 border border-emerald-200 dark:border-zinc-800 text-emerald-800 dark:text-emerald-300 inline-flex items-center gap-1 shadow-sm">
                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Zero Dowry Enforcement
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-zinc-900 border border-indigo-200 dark:border-zinc-800 text-indigo-800 dark:text-indigo-300 inline-flex items-center gap-1 shadow-sm">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                2-Way Photo Privacy Gating
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-zinc-900 border border-amber-200 dark:border-zinc-800 text-amber-800 dark:text-amber-300 inline-flex items-center gap-1 shadow-sm">
                <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Verified Wali Gating
              </span>
            </div>
          </div>

          {/* Col 2: Principles */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 uppercase tracking-wider mb-3">
              Core Principles
            </h4>
            <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                Sunnah Mahr Only (No Demands)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                Guardian (Wali) Protocol
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                Third-Party KYC Identity Shield
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                Peer-to-Peer Encrypted WebRTC
              </li>
            </ul>
          </div>

          {/* Col 3: Legal & Trust Policies (Prominent Links) */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 uppercase tracking-wider mb-3">
              Legal & Trust
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a
                  href="/terms"
                  onClick={(e) => handleNav('terms', e)}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Terms of Service</span>
                </a>
              </li>
              <li>
                <a
                  href="/privacy"
                  onClick={(e) => handleNav('privacy', e)}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Privacy Policy</span>
                </a>
              </li>
              <li>
                <a
                  href="/refund"
                  onClick={(e) => handleNav('refund', e)}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Strict Refund Policy</span>
                </a>
              </li>
              <li>
                <a
                  href="/disclaimer"
                  onClick={(e) => handleNav('disclaimer', e)}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>KYC & Safety Disclaimer</span>
                </a>
              </li>
              <li>
                <a
                  href="/pledge"
                  onClick={(e) => handleNav('pledge', e)}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Anti-Dowry Registry</span>
                </a>
              </li>
              <li className="pt-2">
                <PWAInstallButton variant="badge" />
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer Banner & Language */}
        <div className="border-t border-zinc-200 dark:border-zinc-900 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <p>© {new Date().getFullYear()} DaheejFree Matrimonial Foundation. All rights reserved.</p>
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-600">
              <span>•</span>
              <span>Third-Party KYC via Didit</span>
              <span>•</span>
              <span>Zero Dowry Tolerance</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PWAInstallButton variant="navbar" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 flex items-center gap-1 font-medium">
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                Language:
              </span>
              <LanguageSelector direction="up" variant="compact" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
