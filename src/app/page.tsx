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
      {/* Hero Section with Islamic Geometric Pattern & Bride/Groom Silhouette/Art */}
      <section className="relative overflow-hidden pt-12 pb-24 sm:pt-20 sm:pb-32 border-b border-zinc-200 dark:border-zinc-800/80">
        {/* Islamic Star & Geometric Background Overlay */}
        <div className="absolute inset-0 opacity-10 dark:opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-zinc-950/70 to-zinc-950 pointer-events-none" />

        {/* Decorative Islamic Arch & Bride / Groom Silhouette Visual Banner */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-full opacity-15 dark:opacity-25 pointer-events-none flex justify-center items-start overflow-hidden">
          <div className="w-[800px] h-[500px] rounded-b-[400px] border-b-2 border-emerald-500/40 bg-gradient-to-b from-emerald-600/10 to-transparent flex items-end justify-center pb-8">
            <div className="flex items-center gap-6 text-emerald-400">
              <Heart className="w-12 h-12 animate-pulse text-amber-400" />
            </div>
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* Shariah Compliance Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-300 text-xs font-semibold shadow-sm dark:shadow-xl dark:shadow-emerald-950/80">
            <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Islamic Anti-Dowry Matrimonial Standard • 100% Shariah Aligned</span>
          </div>

          {/* Bride & Groom Art / Silhouette Visual Card */}
          <div className="max-w-xl mx-auto p-4 rounded-3xl bg-white/80 dark:bg-zinc-900/90 border border-emerald-500/30 dark:border-emerald-500/40 shadow-2xl backdrop-blur-md flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Pure Islamic Union</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Halal Bride & Groom Matchmaking</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Bila-Daheej</span>
            </div>
          </div>

          {/* Main Title */}
          <div className="max-w-4xl mx-auto space-y-4">
            <h1 className="text-4xl sm:text-6xl font-black text-zinc-900 dark:text-white tracking-tight leading-[1.1]">
              Pure, Modest &{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 dark:from-emerald-400 dark:via-teal-300 dark:to-amber-300">
                100% Dowry-Free
              </span>{' '}
              Islamic Matrimony
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-300 max-w-3xl mx-auto leading-relaxed">
              Designed with <strong>2-way mutual photo consent</strong>, <strong>Didit-verified identity profiles</strong>,
              and strict <strong>anti-dowry enforcement</strong> to safeguard the dignity of Muslim brides, grooms, and families.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              id="hero-btn-explore"
              onClick={onExploreMatches}
              className="px-7 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center gap-2.5 shadow-lg shadow-emerald-700/20 dark:shadow-emerald-950/80 transition-all hover:scale-105"
            >
              <Users className="w-4 h-4" />
              <span>{isAuthenticated ? 'Go to Dashboard (Explore Matches)' : 'Explore Verified Matches'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {!isAuthenticated && (
              <button
                id="hero-btn-register"
                onClick={onOpenRegister}
                className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-amber-600/20 transition-all hover:scale-105"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Register (Bila-Daheej)</span>
              </button>
            )}

            <button
              id="hero-btn-pricing"
              onClick={onOpenPricing}
              className="px-6 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800 font-bold text-sm flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <Crown className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>View Matrimonial Plans (₹0 - ₹999)</span>
            </button>

            <button
              id="hero-btn-pledge"
              onClick={onOpenPledge}
              className="px-6 py-3.5 rounded-2xl bg-emerald-50 dark:bg-zinc-900/60 hover:bg-emerald-100 dark:hover:bg-zinc-800/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/60 font-semibold text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Read Anti-Dowry Charter</span>
            </button>
          </div>

          {/* Google Fast Registration Hero Callout */}
          {!isAuthenticated && (
            <div className="max-w-md mx-auto pt-2">
              <div className="p-3 bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between gap-3 text-left">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Instant Google Registration</span>
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">1-click Supabase Auth onboarding</p>
                  </div>
                  <button
                    id="hero-btn-google-quick"
                    onClick={onOpenRegister}
                    className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                    </svg>
                    <span>Sign In</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Trust Metric Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-zinc-200 dark:border-zinc-800/60 text-left">
            <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₹0</p>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">Dowry Allowed</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Strict zero-extortion rule</p>
            </div>
            <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">2-Way</p>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">Photo Consent</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Mutual affirmative grant</p>
            </div>
            <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">100%</p>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">Didit Verified</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Automated KYC Protocol</p>
            </div>
            <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <p className="text-2xl font-black text-teal-600 dark:text-teal-400">P2P</p>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">WebRTC Calls</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Private encrypted media</p>
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
