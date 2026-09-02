'use client';

// ==============================================================================
// DAHEEJFREE - UNIFIED LEGAL POLICIES COMPONENT (TERMS, PRIVACY & REFUND)
// Compliant with Indian IT Act Section 79, Dowry Prohibition Act, 1961, & DPDP Act
// ==============================================================================

import React, { useState } from 'react';
import {
  Scale,
  Shield,
  CreditCard,
  AlertTriangle,
  Lock,
  FileText,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Server,
  EyeOff,
  UserX,
  PhoneCall,
  ExternalLink,
  ShieldAlert,
  Gavel,
  BadgeAlert,
} from 'lucide-react';
import { useRouter } from '../../hooks/useRouter';

export type LegalPolicyTab = 'terms' | 'privacy' | 'refund';

interface LegalPoliciesProps {
  initialTab?: LegalPolicyTab;
  onBack?: () => void;
}

export const LegalPolicies: React.FC<LegalPoliciesProps> = ({
  initialTab = 'terms',
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<LegalPolicyTab>(initialTab);
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 py-10 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div>
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 mb-3 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to DaheejFree</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <Scale className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              <span>Legal Governance & Shariah Charters</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Indian IT Act (Sec 79) Intermediary Framework • Dowry Prohibition Act, 1961 • Zero-Tolerance Policy
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div className="inline-flex p-1 rounded-2xl bg-zinc-200/80 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 self-start sm:self-center shadow-inner">
            <button
              onClick={() => setActiveTab('terms')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-300 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms of Service</span>
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </button>
            <button
              onClick={() => setActiveTab('refund')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'refund'
                  ? 'bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Strict Refund Policy</span>
            </button>
          </div>
        </div>

        {/* -------------------------------------------------------------------- */}
        {/* TAB 1: TERMS OF SERVICE & LEGAL LIABILITY (IT ACT SEC 79)            */}
        {/* -------------------------------------------------------------------- */}
        {activeTab === 'terms' && (
          <div className="space-y-8 animate-fade-in">
            {/* Critical Callout */}
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-black text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>MANDATORY LEGAL NOTICE & ASSUMPTION OF RISK UNDER INDIAN LAW</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                By accessing, registering, or communicating via DaheejFree (<code className="font-mono font-semibold">daheejfree.site</code>), you enter into a legally binding agreement under the Indian Contract Act, 1872, and Information Technology Act, 2000. If you do not accept every clause without limitation, you are strictly prohibited from using our services.
              </p>
            </div>

            {/* Terms Content Container */}
            <article className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-xs sm:text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              
              {/* Header Title */}
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Legal Covenant & Operating Terms
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white mt-1">
                  Terms of Service & Intermediary Safe Harbor Declaration
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Effective Date: August 30, 2026 • Governing Jurisdiction: Republic of India
                </p>
              </div>

              {/* Section 1: Intermediary Status */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-center font-black">1</span>
                  Intermediary Status Under Section 79 of the Information Technology Act, 2000
                </h3>
                <p>
                  <strong>DaheejFree</strong> is operated strictly as an <strong>"Intermediary"</strong> as defined under <strong>Section 2(1)(w) and Section 79 of the Indian Information Technology Act, 2000</strong> (along with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021).
                </p>
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <p>
                    <strong>(a) Technical Facilitator Only:</strong> DaheejFree acts solely as an electronic communication platform, algorithmic matchmaking directory, and P2P introduction facilitator. We do not initiate the transmission, select the receiver of the transmission, or modify the information contained in the transmission.
                  </p>
                  <p>
                    <strong>(b) Not an Investigation or Background Agency:</strong> DaheejFree is <strong>NOT</strong> a detective agency, background verification firm, matrimonial bureau, marriage registrar, or credit rating agency. We make no warranty regarding the moral character, criminal history, financial status, family lineage, mental stability, or matrimonial authenticity of any registered user.
                  </p>
                </div>
              </section>

              {/* Section 2: Bold Zero Offline Liability Disclaimer */}
              <section className="space-y-3 p-5 rounded-2xl bg-red-50/60 dark:bg-red-950/20 border-2 border-red-300 dark:border-red-900/60">
                <h3 className="text-base sm:text-lg font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                  <span>2. STRICT ZERO OFFLINE LIABILITY DISCLAIMER</span>
                </h3>
                <p className="font-bold text-red-950 dark:text-red-200 uppercase tracking-wide text-xs">
                  PLEASE READ THIS CAREFULLY: YOU ASSUME 100% PERSONAL RISK FOR ALL OFFLINE ENGAGEMENTS.
                </p>
                <p className="text-zinc-800 dark:text-zinc-200">
                  DaheejFree, its directors, developers, operators, and affiliates assume <strong>ABSOLUTE ZERO LIABILITY</strong> for:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-zinc-700 dark:text-zinc-300">
                  <li>Any physical, verbal, psychological, emotional, or sexual misconduct occurring offline during meetings, family visits, or courtships.</li>
                  <li>Any financial fraud, cash borrowing, extortion, deceitful business proposals, or money transfers between users or their respective families.</li>
                  <li>Any inaccurate or forged biographical claims regarding profession, caste, educational degrees, citizenship, marital status, or income.</li>
                  <li>Any failure of a match to culminate in Nikah or marriage.</li>
                </ul>
                <p className="text-xs font-semibold text-red-800 dark:text-red-300 pt-1">
                  Users and their Guardians (Walis) are exclusively responsible for conducting independent physical due diligence, police verification, community inquiries, and reference checks before solemnizing any Nikah or transferring any assets.
                </p>
              </section>

              {/* Section 3: Anti-Dowry Charter & Mandatory Reporting */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-center font-black">3</span>
                  Anti-Dowry Charter (Dowry Prohibition Act, 1961) & Permanent Blacklisting
                </h3>
                <p>
                  In accordance with the <em>Dowry Prohibition Act, 1961</em> and Islamic Shariah principles, DaheejFree enforces a <strong>Zero-Tolerance Anti-Dowry Policy</strong>.
                </p>
                <div className="space-y-2.5 pl-3 border-l-2 border-emerald-500">
                  <p>
                    <strong>(a) Strict Prohibition:</strong> Demanding, soliciting, giving, taking, or facilitating any dowry (Daheej, Jahez, Salami, cash gifts, luxury vehicles, or real estate demands) directly or indirectly is strictly forbidden.
                  </p>
                  <p>
                    <strong>(b) In-App "Report Profile" Red Flag:</strong> Any user or guardian subjected to dowry coercion, harassment, vulgarity, or misrepresentation can immediately trigger the in-app <span className="font-semibold text-red-600 dark:text-red-400">"Report Profile"</span> / <span className="font-semibold text-red-600 dark:text-red-400">"Report Dowry Demand"</span> mechanism.
                  </p>
                  <p>
                    <strong>(c) Permanent Banning & Law Enforcement Referral:</strong> Upon verification of a dowry demand or abusive conduct:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    <li>The offending account will be <strong>permanently banned and device-blacklisted</strong> without notice or refund.</li>
                    <li>Associated IP addresses, phone numbers, and chat logs will be archived and provided to Indian law enforcement authorities (including State Cyber Cells and Women's Grievance Cells) upon legal requisition under Section 91 CrPC / Section 69 IT Act.</li>
                  </ul>
                </div>
              </section>

              {/* Section 4: Eligibility & Shariah Wali Protocol */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-center font-black">4</span>
                  Age Eligibility & Guardian (Wali) Transparency
                </h3>
                <p>
                  To register on DaheejFree:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Men must be at least <strong>21 years of age</strong>; Women must be at least <strong>18 years of age</strong> (or the legal marriageable age mandated by the laws of India).</li>
                  <li>Muslim female candidates must provide valid contact coordinates for a recognized Shariah Guardian (Wali: Father, Brother, Uncle, or Legal Guardian) to maintain dignified matrimonial protocol.</li>
                </ul>
              </section>

              {/* Section 5: WebRTC & Communication Integrity */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-center font-black">5</span>
                  Acceptable Use for WebRTC Video, Voice & Messaging
                </h3>
                <p>
                  All audio/video communications occur peer-to-peer (P2P). Users agree not to transmit unlawful, defamatory, obscene, pornographic, pedophilic, invasive of another's privacy, or religiously insulting content. Recording or capturing video sessions without explicit mutual consent is a criminal offense under Section 66E of the IT Act.
                </p>
              </section>

              {/* Section 6: Grievance Officer */}
              <section className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <h4 className="font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-wider">
                  Statutory Grievance Redressal Mechanism (Rule 3(2) IT Rules 2021)
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  For formal legal grievances, law enforcement notices, or cyber complaints, contact our designated Grievance Officer:
                </p>
                <div className="text-xs font-mono bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <p><strong>Grievance & Compliance Officer:</strong> Legal Cell, DaheejFree Platform</p>
                  <p><strong>Email:</strong> compliance@daheejfree.site / legal@daheejfree.site</p>
                  <p><strong>Response Turnaround:</strong> Acknowledgment within 24 hours, resolution within 15 days.</p>
                </div>
              </section>

            </article>
          </div>
        )}

        {/* -------------------------------------------------------------------- */}
        {/* TAB 2: PRIVACY POLICY (MINIMALIST, SECURE, DIDIT KYC & IP LOGGING)  */}
        {/* -------------------------------------------------------------------- */}
        {activeTab === 'privacy' && (
          <div className="space-y-8 animate-fade-in">
            {/* Privacy Summary Banner */}
            <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-900/60 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-black text-sm">
                <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>PRIVACY-BY-DESIGN & ZERO COMMERCIAL DATA RESALE PROMISE</span>
              </div>
              <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                DaheejFree is engineered around the sacred Islamic principle of <em>Haya</em> (Modesty) and digital sovereignty. We do not monetize your private matrimonial search, your phone numbers, or your family contacts.
              </p>
            </div>

            {/* Privacy Body */}
            <article className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-xs sm:text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              
              {/* Header Title */}
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Data Protection & Privacy Policy
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white mt-1">
                  Privacy Policy & Digital Personal Data Protection Disclosure
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Compliant with Digital Personal Data Protection Act, 2023 (DPDP Act) & Shariah Ethics
                </p>
              </div>

              {/* Section 1: IP Address Logging */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs flex items-center justify-center font-black">1</span>
                  Mandatory IP Address & Device Metadata Logging for Safety
                </h3>
                <p>
                  To prevent fraudulent impersonation, cyberstalking, dowry harassment, and to assist statutory law enforcement agencies:
                </p>
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <p>
                    <strong>(a) What We Log:</strong> We automatically collect and log your <strong>Internet Protocol (IP) address</strong>, browser user-agent, device hardware fingerprints, login timestamps, and session tokens whenever you access the platform.
                  </p>
                  <p>
                    <strong>(b) Legal Purpose:</strong> IP logs are strictly utilized for (i) preventing multi-account spam and malicious bots, (ii) authenticating WebRTC connection handshakes, and (iii) complying with statutory disclosure orders issued by Indian Courts or cybercrime investigative authorities under Section 69 of the Information Technology Act.
                  </p>
                </div>
              </section>

              {/* Section 2: Strict No Data Selling Guarantee */}
              <section className="space-y-3 p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border-2 border-emerald-300 dark:border-emerald-900/60">
                <h3 className="text-base sm:text-lg font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>2. ZERO COMMERCIAL DATA RESALE GUARANTEE</span>
                </h3>
                <p className="font-bold text-emerald-950 dark:text-emerald-200 text-xs">
                  WE DO NOT SELL, RENT, LEASE, OR TRADE YOUR PERSONAL DATA TO THIRD PARTIES.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-zinc-800 dark:text-zinc-200">
                  <li>Your phone number, email, date of birth, and caste/sect details are never monetized.</li>
                  <li>Your <strong>Wali (Guardian) names and contact numbers</strong> are strictly quarantined and only revealed to KYC-verified candidates under explicit Shariah gating protocols.</li>
                  <li>We do not run third-party behavioral advertising trackers, targeted ad networks, or data brokers.</li>
                </ul>
              </section>

              {/* Section 3: Third-Party Didit KYC Handling */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs flex items-center justify-center font-black">3</span>
                  Third-Party KYC Identity Gateway ("Didit.me") Architecture
                </h3>
                <p>
                  To ensure candidate safety without compromising data privacy, all government identity verification (Aadhaar, PAN, Passport, Voter ID, and Biometric Liveness) is executed exclusively through our external identity partner, <strong>Didit Identity Services (<code className="font-mono text-xs">didit.me</code>)</strong>.
                </p>
                <div className="space-y-2 pl-3 border-l-2 border-indigo-500">
                  <p>
                    <strong>(a) No Raw Document Storage:</strong> DaheejFree servers <strong>DO NOT store raw Aadhaar card files, PAN card images, or biometric face vectors</strong>. All OCR processing and facial matching occurs in Didit’s encrypted enclave.
                  </p>
                  <p>
                    <strong>(b) Cryptographic Attestation Only:</strong> Upon successful verification by Didit, DaheejFree receives only a cryptographic boolean confirmation (<code className="font-mono text-xs">kyc_verified = true</code>) and extracted non-sensitive metadata (such as full name and verified age) to award the Verified Badge.
                  </p>
                </div>
              </section>

              {/* Section 4: 2-Way Photo Consent Gating */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs flex items-center justify-center font-black">4</span>
                  2-Way Photo Privacy & Anti-Screenshot Protection
                </h3>
                <p>
                  Candidate photographs (especially for female profiles) are protected by a high-grade dynamic Gaussian blur. Photos can only be viewed when:
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-xs">
                  <li>The viewer is logged in and KYC-verified.</li>
                  <li>The candidate explicitly accepts an incoming photo permission request via the Realtime consent pipeline.</li>
                </ol>
                <p className="text-xs text-zinc-500 italic">
                  Users can revoke photo access at any moment with instant database and cache termination.
                </p>
              </section>

              {/* Section 5: Data Retention & Deletion */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs flex items-center justify-center font-black">5</span>
                  User Right to Erasure & Account Deletion
                </h3>
                <p>
                  You retain full ownership of your data under the DPDP Act, 2023. You may initiate total account deletion at any time via the profile settings console. Upon deletion, your profile, photos, and active connection tokens will be purged immediately from active databases. (Security audit logs and transaction IDs are retained for statutory accounting and legal compliance periods).
                </p>
              </section>

            </article>
          </div>
        )}

        {/* -------------------------------------------------------------------- */}
        {/* TAB 3: STRICT REFUND POLICY (ZERO REFUNDS & PLATFORM ACCESS DEF)     */}
        {/* -------------------------------------------------------------------- */}
        {activeTab === 'refund' && (
          <div className="space-y-8 animate-fade-in">
            {/* Refund Alert Banner */}
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-black text-sm">
                <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>EXPLICIT STRICT REFUND POLICY: ALL PAYMENTS ARE 100% NON-REFUNDABLE</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Before upgrading to <strong>Gold</strong> or <strong>Diamond</strong> membership tiers on DaheejFree, please read this policy thoroughly. All subscription fees are definitive, immediate, and non-refundable under all circumstances.
              </p>
            </div>

            {/* Refund Body */}
            <article className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-xs sm:text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              
              {/* Header Title */}
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Billing Terms & Cancellation Policy
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white mt-1">
                  Strict Refund & Subscription Fee Policy
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Effective Immediately Upon Checkout • Applies to all Gold & Diamond Tier Subscriptions
                </p>
              </div>

              {/* Section 1: Zero Refunds Clause */}
              <section className="space-y-3 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-center font-black">1</span>
                  Absolute Zero Refund Policy (100% Non-Refundable)
                </h3>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  All payments made for Gold Membership, Diamond Membership, Wali Gating Unlocks, or any digital add-on services are 100% STRICTLY NON-REFUNDABLE once processed.
                </p>
                <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 pl-3 border-l-2 border-amber-500">
                  <p>
                    • No full, partial, prorated, or retrospective refunds will be granted under any circumstance.
                  </p>
                  <p>
                    • No refunds will be provided if you change your mind, find a match outside the platform, delete your account, or choose not to utilize premium features.
                  </p>
                  <p>
                    • Accounts banned or terminated for violating our Anti-Dowry Charter, harassing users, or providing fraudulent KYC documents automatically forfeit all remaining subscription periods without refund.
                  </p>
                </div>
              </section>

              {/* Section 2: Precise Legal Service Definition */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-center font-black">2</span>
                  Legal Definition of Service: Digital Platform Access Only
                </h3>
                <p>
                  When you purchase a subscription on DaheejFree, you are paying <strong>EXCLUSIVELY FOR DIGITAL PLATFORM ACCESS AND INFRASTRUCTURE CONSUMPTION</strong>, which includes:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Bandwidth allocation for high-definition <strong>WebRTC video and voice calling</strong> infrastructure.</li>
                  <li>Real-time websocket channels for <strong>instant encrypted text messaging</strong> and photo consent pipelines.</li>
                  <li>Access to verified <strong>Guardian (Wali) contact details</strong> on Diamond tier profiles.</li>
                  <li>Priority profile visibility and verified matchmaking badges.</li>
                </ul>
              </section>

              {/* Section 3: NO Marriage Guarantee Clause */}
              <section className="space-y-3 p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-900/60">
                <h3 className="text-base sm:text-lg font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
                  <BadgeAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>3. NO GUARANTEE OF MARRIAGE, PROPOSAL, OR OFFLINE OUTCOME</span>
                </h3>
                <p className="text-zinc-800 dark:text-zinc-200">
                  Payment of membership fees <strong>DOES NOT GUARANTEE</strong>:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-zinc-700 dark:text-zinc-300">
                  <li>That any candidate will accept your match proposal or photo consent request.</li>
                  <li>That any conversation will lead to an offline meeting, engagement, or Nikah.</li>
                  <li>That any specific number of active profiles matching your exact cultural, sect, or educational criteria will be available in your city.</li>
                </ul>
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 pt-1">
                  Matrimonial decisions are mutual, voluntary, and governed by Allah's divine decree and human free will. Subscription fees compensate for technical hosting and server upkeep, never for matrimonial results.
                </p>
              </section>

              {/* Section 4: Chargeback & Dispute Consequences */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-center font-black">4</span>
                  Fraudulent Chargebacks & Payment Disputes
                </h3>
                <p>
                  Any user who initiates a fraudulent payment chargeback or false dispute with Razorpay, Dodo Payments, their issuing bank, or credit card provider after utilizing platform features will be subject to:
                </p>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs">
                  <li>Immediate permanent blacklisting of their account, phone number, and IP address.</li>
                  <li>Submission of digital consumption logs (WebRTC connection timestamps, chat logs, IP traces) to the card network and payment aggregator as conclusive proof of service delivery.</li>
                  <li>Legal recovery proceedings under Indian contract laws for dishonor and recovery of processing costs.</li>
                </ol>
              </section>

              {/* Section 5: Payment Support */}
              <section className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <h4 className="font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-wider">
                  Payment & Billing Inquiries
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  If you experience a technical billing failure (such as a double-charge where the bank debited your account twice for a single transaction), please send your transaction reference ID to:
                </p>
                <div className="text-xs font-mono bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <p><strong>Billing Support Desk:</strong> billing@daheejfree.site</p>
                  <p><strong>Required Info:</strong> Order ID, Razorpay/Dodo Payment Reference, Registered Email.</p>
                </div>
              </section>

            </article>
          </div>
        )}

        {/* Footer Summary / Disclaimer */}
        <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <p>© {new Date().getFullYear()} DaheejFree Matrimonial Platform (daheejfree.site). All rights reserved.</p>
          <p className="mt-1">Dedicated to 100% Dowry-Free Sunnah Marriages • Protected by Indian IT Act & DPDP Act.</p>
        </div>
      </div>
    </div>
  );
};

export default LegalPolicies;
