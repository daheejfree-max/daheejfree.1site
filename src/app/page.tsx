'use client';

// ==============================================================================
// DAHEEJFREE ROOT LANDING GATEWAY: ISLAMIC THEME & BRIDE/GROOM HERO
// ==============================================================================

import React from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  PhoneCall,
  Crown,
  Heart,
  CheckCircle2,
  Users,
  Sparkles,
  ArrowRight,
  Shield,
  FileText,
  BadgeCheck,
  Scale,
  Video,
  KeyRound,
  Coins,
  Check,
} from 'lucide-react';
import { Logo } from '../components/brand/Logo';
import { SUBSCRIPTION_PLANS } from '../lib/dodoPayments';
import { SubscriptionTier } from '../types';

interface LandingPageProps {
  onExploreMatches?: () => void;
  onOpenPricing?: () => void;
  onOpenRegister?: () => void;
  onOpenPledge?: () => void;
  isAuthenticated?: boolean;
}

export default function LandingGatewayPage({
  onExploreMatches,
  onOpenPricing,
  onOpenRegister,
  onOpenPledge,
  isAuthenticated,
}: LandingPageProps) {
  const pillars = [
    {
      id: 'pillar-dowry-free',
      number: '01',
      title: '100% Dowry-Free Shariah Covenant',
      tag: 'Strict Zero Extortion',
      icon: Scale,
      iconColor: 'text-amber-400',
      badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
      description:
        'Every candidate and guardian legally executes our Islamic Anti-Dowry (Bila-Daheej) Charter. Solicitations of cash, luxury demands, or wedding cost extortion lead to immediate lifetime bans.',
      highlights: [
        'Mandatory signed charter on registration',
        'Real-time automated extortion keyword detection',
        'Zero tolerance: Instant blacklist for offenders',
      ],
    },
    {
      id: 'pillar-photo-consent',
      number: '02',
      title: '2-Way Mutual Photo Consent Gating',
      tag: 'Cryptographic Modesty',
      icon: Lock,
      iconColor: 'text-emerald-400',
      badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
      description:
        'Profile portraits remain securely obscured with biometric-level blurring. Photographs are only revealed when both individuals explicitly grant mutual consent.',
      highlights: [
        'Default high-grade blur for all portraits',
        'Bi-directional affirmative consent required',
        'Revoke visibility anytime with 1-click',
      ],
    },
    {
      id: 'pillar-admin-kyc',
      number: '03',
      title: 'Automated Didit KYC Protocol',
      tag: 'Didit Verified Profiles',
      icon: ShieldCheck,
      iconColor: 'text-indigo-400',
      badgeColor: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60',
      description:
        'Zero bots, zero fraudulent impersonators. Every single account undergoes mandatory SMS OTP verification followed by automated biometric and cryptographic verification via the Didit protocol.',
      highlights: [
        'Automated Didit identity verification protocol',
        'Cryptographic biometric liveness & ID inspection',
        'Strict bot elimination challenge integration',
      ],
    },
    {
      id: 'pillar-webrtc-calling',
      number: '04',
      title: 'Encrypted WebRTC P2P Calling',
      tag: 'Peer-to-Peer & Halal',
      icon: PhoneCall,
      iconColor: 'text-teal-400',
      badgeColor: 'bg-teal-950/80 text-teal-300 border-teal-800/60',
      description:
        'Direct, crystal-clear audio and video communication without exposing personal phone numbers. Diamond tier unlocks direct Wali-supervised family conferences.',
      highlights: [
        'End-to-end browser-based WebRTC signaling',
        'No phone number disclosure required',
        'Diamond tier family & Wali conferencing',
      ],
    },
  ];

  const landingTiers: SubscriptionTier[] = ['free', 'gold', 'diamond'];

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-emerald-500 selection:text-white dark:selection:text-zinc-950 transition-colors">
      {/* Hero Section: Clean Obsidian Dark Aesthetic */}
      <section className="relative overflow-hidden bg-zinc-950 pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-zinc-800/80">
        {/* Soft, Faint Emerald Glow at Top Center */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          {/* 1. Single Subtle Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-medium shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>100% Dowry-Free • Shariah-Compliant Matrimony</span>
          </div>

          {/* 2. Headline & Subheadline */}
          <div className="max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.12]">
              Pure, Modest &{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                100% Dowry-Free
              </span>{' '}
              Islamic Matrimony
            </h1>
            <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mt-4">
              Designed with mutual photo consent, government-verified identity profiles, and strict anti-dowry enforcement to safeguard the dignity of Muslim families.
            </p>
          </div>

          {/* 3. Radical CTA Consolidation (Max 2 Buttons) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <button
              id="hero-btn-explore"
              onClick={onExploreMatches}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <span>{isAuthenticated ? 'Go to Dashboard' : 'Explore Verified Matches'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="hero-btn-pricing"
              onClick={onOpenPricing}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>View Plans & Features</span>
            </button>
          </div>

          {/* 4. Bottom Feature / Stat Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-12 text-left">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                <Scale className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-white">₹0 Dowry Guarantee</p>
              <p className="text-xs text-zinc-400 mt-1">Strict zero-extortion rule</p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                <Eye className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-white">2-Way Consent</p>
              <p className="text-xs text-zinc-400 mt-1">Mutual photo permissions</p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-3">
                <BadgeCheck className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-white">Government ID Verified</p>
              <p className="text-xs text-zinc-400 mt-1">Biometric Didit.me protocol</p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                <Lock className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-white">Encrypted Privacy</p>
              <p className="text-xs text-zinc-400 mt-1">Private P2P browser calls</p>
            </div>
          </div>
        </div>
      </section>

      {/* The 4 Pillars of Trust Section */}
      <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            Shariah-First Engineering
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            The 4 Pillars of DaheejFree Trust
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Every feature on DaheejFree is cryptographically structured to eliminate commercialization, uphold personal modesty, and honor Sunnah principles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                id={pillar.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-7 flex flex-col justify-between hover:border-emerald-500/40 dark:hover:border-zinc-700 transition-all shadow-sm dark:shadow-xl space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-inner">
                        <Icon className={`w-6 h-6 ${pillar.iconColor}`} />
                      </div>
                      <div>
                        <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">Pillar {pillar.number}</span>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight">{pillar.title}</h3>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${pillar.badgeColor}`}>
                      {pillar.tag}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-950/80 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800/80 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Key Protections:
                  </p>
                  <ul className="space-y-1.5">
                    {pillar.highlights.map((h, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3-Tier Synchronized Pricing Grid Preview */}
      <section className="py-16 bg-zinc-100/60 dark:bg-zinc-900/50 border-t border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-xs">
              Transparent Shariah Monetization
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Honest, Synchronized Matrimonial Plans
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Transparent membership tiers to connect with righteous families without dowry, hidden costs, or exploitative commissions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {landingTiers.map((tierKey) => {
              const plan = SUBSCRIPTION_PLANS[tierKey];
              const isDiamond = tierKey === 'diamond';
              const isGold = tierKey === 'gold';

              return (
                <div
                  key={tierKey}
                  className={`relative rounded-3xl p-7 flex flex-col justify-between border shadow-sm dark:shadow-xl transition-all duration-200 hover:-translate-y-1 ${
                    isDiamond
                      ? 'border-emerald-500 dark:border-emerald-500/80 bg-emerald-50/50 dark:bg-gradient-to-b dark:from-emerald-950/60 dark:to-zinc-900 ring-2 ring-emerald-500/20'
                      : isGold
                      ? 'border-amber-300 dark:border-amber-600/50 bg-amber-50/30 dark:bg-zinc-900'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80'
                  }`}
                >
                  {isDiamond && (
                    <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 px-3.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                      <Crown className="w-3.5 h-3.5 text-amber-300" />
                      Wali & Video Calls Included
                    </div>
                  )}

                  {isGold && (
                    <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 px-3.5 py-1 rounded-full bg-amber-500 text-zinc-950 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                      <Sparkles className="w-3.5 h-3.5 text-zinc-950" />
                      Most Popular For Singles
                    </div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {plan.eyebrow}
                      </span>
                      <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
                        {plan.name}
                      </h3>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-4xl font-black text-zinc-900 dark:text-white">
                          ₹{plan.priceINR}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                          {plan.period}
                        </span>
                        {plan.priceUSD > 0 && (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-1">
                            (${plan.priceUSD})
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {plan.desc}
                    </p>

                    <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
                      <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                        Key Inclusions:
                      </p>
                      {plan.features.slice(0, 5).map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 mt-4">
                    <button
                      onClick={onOpenPricing}
                      className={`w-full py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isDiamond
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-700/25 active:scale-[0.98]'
                          : isGold
                          ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-md active:scale-[0.98]'
                          : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      <span>{plan.btnText || 'Choose Plan'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Shariah Covenant & Anti-Dowry Guarantee */}
      <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/50 dark:from-zinc-900 dark:via-zinc-900 dark:to-emerald-950/50 border border-emerald-300 dark:border-emerald-500/30 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-md dark:shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
            <Scale className="w-8 h-8" />
          </div>

          <div className="space-y-3 max-w-2xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
              The Bila-Daheej (Anti-Dowry) Islamic Covenant
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              "The most blessed marriage is the one with the least financial burden." (Musnad Ahmad). 
              Our mission is to eradicate un-Islamic dowry demands, extravagant financial extortion, and social ostentation from marriage proposals once and for all.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={onExploreMatches}
              className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-700/20 dark:shadow-emerald-950 transition-all hover:scale-105"
            >
              Join the Movement • Find Your Match
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
