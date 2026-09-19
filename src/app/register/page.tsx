'use client';

// ==============================================================================
// STRICT SIGNUP FORM HANDLER & EMAIL VERIFICATION INTERCEPTOR
// ==============================================================================

import React, { useState } from 'react';
import { Shield, Lock, Mail, User, Phone, ArrowRight, AlertCircle, CheckCircle, Sparkles, Gavel, FileText, X, ExternalLink } from 'lucide-react';
import { Logo } from '../../components/brand/Logo';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { useRouter } from '../../hooks/useRouter';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { GoogleFastRegisterModal } from '../../components/auth/GoogleFastRegisterModal';
import { Gender, Profile } from '../../types/database';
import { useAuth } from '../../hooks/useAuth';
import { updateLastKnownIp } from '../actions/security';
import { LegalPolicies, LegalPolicyTab } from '../../components/legal/LegalPolicies';

interface RegisterPageProps {
  onSuccess?: (userId: string) => void;
  onNavigateLogin?: () => void;
}

export default function RegisterPage({ onSuccess, onNavigateLogin }: RegisterPageProps) {
  const router = useRouter();
  const { switchUser, allProfiles } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [age, setAge] = useState<number>(24);
  const [location, setLocation] = useState('');
  const [profession, setProfession] = useState('');
  const [waliName, setWaliName] = useState('');
  const [waliRelation, setWaliRelation] = useState('Father');
  const [waliPhone, setWaliPhone] = useState('');
  const [waliEmail, setWaliEmail] = useState('');
  const [antiDowryPledge, setAntiDowryPledge] = useState(true);
  const [legalConsent, setLegalConsent] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalPolicyTab | null>(null);

  const [ageError, setAgeError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailVerificationPending, setIsEmailVerificationPending] = useState(false);
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string; avatar_url: string } | null>(null);

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Phase 1: Age Eligibility Check
    if (gender === 'male' && age < 21) {
      const msg = '⚠️ Minimum age eligibility for grooms is 21 years.';
      setAgeError(msg);
      setErrorMessage(msg);
      return;
    }

    if (gender === 'female' && age < 18) {
      const msg = '⚠️ Minimum age eligibility for brides is 18 years.';
      setAgeError(msg);
      setErrorMessage(msg);
      return;
    }
    setAgeError(null);

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Please fill in all mandatory account fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (!antiDowryPledge) {
      setErrorMessage('You must agree to the Islamic Anti-Dowry (Bila-Daheej) Charter to proceed.');
      return;
    }

    if (!legalConsent) {
      setErrorMessage('You must agree to the Terms of Service, Privacy Policy, and Third-Party KYC Disclaimer to proceed.');
      return;
    }

    setIsLoading(true);

    try {
      const consentTimestamp = new Date().toISOString();

      // 1. Call supabase.auth.signUp with email, password, and metadata
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            gender,
            role: 'candidate',
            phone: phone || waliPhone,
            legal_consent_accepted_at: consentTimestamp,
          },
        },
      });

      if (error) {
        console.error('[Register] Supabase signUp raw error object:', error);
        setIsLoading(false);
        setErrorMessage(error.message || 'Registration failed. Please check your details and try again.');
        return;
      }

      // 2. Strict Interception: If user was created but session is null -> Email Verification is required
      // Prevent ANY redirection to /matches or /onboarding until an active session is verified!
      if (data?.user && !data?.session) {
        setIsLoading(false);
        setIsEmailVerificationPending(true);
        return;
      }

      // 3. If session is directly returned (e.g. Email confirmation disabled in development environment)
      if (data?.session && data.user) {
        setIsLoading(false);
        const userId = data.user.id;

        // Provision profile in local state
        const newProfile: Profile = {
          id: userId,
          phone_number: phone || waliPhone || '+91 98765 43210',
          full_name: fullName.trim(),
          gender,
          age: Number(age) || 24,
          avatar_url:
            gender === 'female'
              ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80'
              : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
          bio: 'Assalamu Alaikum. Seeking pious, dowry-free Nikah based on Quran and Sunnah.',
          location: location || 'Hyderabad, TS',
          profession: profession || 'Working Professional',
          education: 'Bachelor Degree',
          sect: 'Sunni',
          preferred_sect: 'Any',
          religious_sect: 'Sunni',
          marital_status: 'Never Married',
          has_children: false,
          height_cm: gender === 'female' ? 165 : 178,
          anti_dowry_pledged: true,
          kyc_status: 'verified',
          kyc_document_type: 'Government Photo ID',
          kyc_document_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500',
          wali_name: waliName || (gender === 'female' ? 'Guardian' : fullName.trim()),
          wali_relation: waliRelation || 'Father',
          wali_phone: waliPhone || phone || '+91 98765 43210',
          wali_email: waliEmail.trim() || email.trim(),
          legal_consent_accepted_at: consentTimestamp,
          terms_accepted: true,
          privacy_policy_accepted: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          subscription_tier: 'free',
        };

        // Try upserting to remote Supabase profiles table
        try {
          const { error: dbInsertErr } = await supabase.from('profiles').upsert({
            id: userId,
            full_name: fullName.trim(),
            gender: gender || 'female',
            phone_number: phone || waliPhone || null,
            age: Number(age) || 24,
            location: location || 'Hyderabad, TS',
            profession: profession || 'Working Professional',
            sect: 'Sunni',
            preferred_sect: 'Any',
            religious_sect: 'Sunni',
            wali_name: waliName || (gender === 'female' ? 'Guardian' : fullName.trim()),
            wali_relation: waliRelation || 'Father',
            wali_phone: waliPhone || phone || null,
            wali_email: waliEmail.trim() || email.trim(),
            anti_dowry_pledged: true,
            kyc_status: 'verified',
            legal_consent_accepted_at: consentTimestamp,
            terms_accepted: true,
            privacy_policy_accepted: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id', ignoreDuplicates: true });

          if (dbInsertErr) {
            console.error('[Register] Supabase profile upsert raw error object:', dbInsertErr);
          }

          // Strict explicit legal consent update using exact column names
          const { error: updateErr } = await supabase.from('profiles').update({
            terms_accepted: true,
            privacy_policy_accepted: true,
            anti_dowry_pledged: true,
            updated_at: new Date().toISOString(),
          }).eq('id', userId);

          if (updateErr) {
            console.error('[Register] Supabase legal consent update error:', updateErr);
          }
        } catch (dbErr) {
          console.error('[Register] Profile database upsert exception:', dbErr);
        }

        daheejStore.createProfile(newProfile);
        daheejStore.setCurrentUserId(userId);
        switchUser(userId);
        // Security audit: capture and update last_known_ip
        updateLastKnownIp(userId).catch((err) => console.warn('[Security] IP registration log error:', err));

        if (typeof document !== 'undefined') {
          document.cookie = `sb-access-token=${data.session.access_token}; Path=/; SameSite=None; Secure; Max-Age=604800`;
          document.cookie = `daheej_auth_session=${data.session.access_token}; Path=/; SameSite=None; Secure; Max-Age=604800`;
        }

        router.refresh();
        if (onSuccess) onSuccess(userId);
        else router.push('/matches');
        return;
      }

      // Fallback: If no user returned
      setIsLoading(false);
      setErrorMessage('Unable to register account at this time. Please try again.');
    } catch (err: unknown) {
      console.error('[Register] SignUp unhandled catch error:', err);
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setErrorMessage(msg);
    }
  };

  const handleGoogleSuccess = async (userData: { name: string; email: string; avatar_url: string }) => {
    // Security Fix: Profile lookup and routing relies EXCLUSIVELY on authenticated user.id
    const { data: authData } = await supabase.auth.getUser();
    const authenticatedId = authData?.user?.id;

    if (authenticatedId) {
      daheejStore.setCurrentUserId(authenticatedId);
      switchUser(authenticatedId);
      router.refresh();
      if (onSuccess) onSuccess(authenticatedId);
      else router.push('/matches');
      return;
    }

    setGoogleUser(userData);
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-zinc-900 dark:text-zinc-100 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          Create Your Nikah Profile
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
          Strictly Dowry-Free (Bila-Daheej), Shariah-compliant matrimonial matchmaking.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-8 px-6 sm:px-10 rounded-3xl shadow-xl dark:shadow-2xl space-y-6 transition-colors">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Persistent Verification Card (When data.user && !data.session) */}
          {isEmailVerificationPending ? (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                <Mail className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white">
                  Registration Successful!
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 max-w-sm mx-auto leading-relaxed">
                  We've sent a verification link to your email. Please verify your account before logging in.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300 text-left space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                  <Shield className="w-4 h-4" /> Next Steps:
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  1. Check your email inbox at <span className="font-mono font-bold text-amber-900 dark:text-amber-200">{email}</span>.<br />
                  2. Click the verification link provided in the message.<br />
                  3. Return to the portal and sign in with your credentials.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  id="btn-proceed-to-login"
                  onClick={() => {
                    if (onNavigateLogin) onNavigateLogin();
                    else router.push('/login');
                  }}
                  className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Proceed to Sign In
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Google Fast Registration Option */}
              <div className="space-y-4">
                <GoogleSignInButton mode="register" onGoogleSuccess={handleGoogleSuccess} />

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-zinc-200 dark:border-zinc-800 w-full" />
                  <span className="bg-white dark:bg-zinc-900 px-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Or register with email
                  </span>
                </div>
              </div>

              {/* Strict Signup Form */}
              <form onSubmit={handleSignup} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Full Legal Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                    <input
                      id="register-input-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Tariq Mansoor"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Email & Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                      <input
                        id="register-input-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                      <input
                        id="register-input-password"
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Candidate Role & Age */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                        Candidate Role
                      </label>
                      <select
                        id="register-select-gender"
                        value={gender}
                        onChange={(e) => handleGenderChange(e.target.value as Gender)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 px-3 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
                      >
                        <option value="female">Sister (Bride)</option>
                        <option value="male">Brother (Groom)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                        Age
                      </label>
                      <input
                        id="register-input-age"
                        type="number"
                        min={gender === 'male' ? 21 : 18}
                        max={75}
                        required
                        value={age}
                        onChange={(e) => handleAgeChange(Number(e.target.value))}
                        className={`w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 px-3 py-3 rounded-xl border transition-colors ${
                          ageError
                            ? 'border-red-500 focus:border-red-600'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                  </div>
                  {ageError && (
                    <div id="register-age-error-msg" className="p-2 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-[11px] text-red-700 dark:text-red-300 font-semibold flex items-center gap-1.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                      <span>{ageError}</span>
                    </div>
                  )}
                </div>

                {/* City & Profession */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      City, State
                    </label>
                    <input
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Mumbai, MH"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 px-3 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Profession
                    </label>
                    <input
                      type="text"
                      required
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="e.g. Doctor, Engineer"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 px-3 py-3 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Guardian / Wali Details */}
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <h4 className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Wali (Guardian) Details
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      id="register-input-wali-name"
                      type="text"
                      required
                      value={waliName}
                      onChange={(e) => setWaliName(e.target.value)}
                      placeholder="Guardian Full Name"
                      className="w-full bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
                    />
                    <select
                      id="register-select-wali-relation"
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
                      id="register-input-wali-phone"
                      type="tel"
                      required
                      value={waliPhone}
                      onChange={(e) => setWaliPhone(e.target.value)}
                      placeholder="Guardian Phone (+91 ...)"
                      className="w-full bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
                    />
                    <input
                      id="register-input-wali-email"
                      type="email"
                      required
                      value={waliEmail}
                      onChange={(e) => setWaliEmail(e.target.value)}
                      placeholder="Guardian Email (wali@domain.com)"
                      className="w-full bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700"
                    />
                  </div>
                </div>

                {/* Anti-Dowry Pledge Checkbox */}
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-300 dark:border-emerald-700/60 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="signup-anti-dowry"
                    checked={antiDowryPledge}
                    onChange={(e) => setAntiDowryPledge(e.target.checked)}
                    className="mt-0.5 accent-emerald-600 w-4 h-4 rounded cursor-pointer"
                    required
                  />
                  <label htmlFor="signup-anti-dowry" className="text-xs text-emerald-900 dark:text-emerald-200 leading-snug cursor-pointer">
                    <strong>Solemn Shariah Pledge:</strong> I solemnly declare under Allah that I will not demand, accept, or facilitate any dowry (Daheej) in any form for this Nikah.
                  </label>
                </div>

                {/* PROMINENT ZERO-LIABILITY LEGAL WAIVER & PLATFORM DISCLAIMER */}
                <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/60 space-y-2.5 text-xs text-zinc-800 dark:text-zinc-200">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-extrabold text-[12px] uppercase tracking-wider">
                    <Gavel className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Zero-Liability & Intermediary Legal Disclaimer</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                    <strong>Technical Intermediary Only:</strong> DaheejFree operates exclusively as an electronic introduction and matchmaking platform under <strong>Section 79 of the Indian IT Act, 2000</strong>. DaheejFree, its founders, operators, developers, and affiliates <strong>assume ABSOLUTE ZERO LIABILITY OR RESPONSIBILITY</strong> for any user actions, identity veracity, offline meetings, marriage decisions, financial transactions, dowry demands, or marital outcomes.
                  </p>
                  <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200 font-medium">
                    You and your legal Guardians (Walis) are <strong>100% exclusively responsible</strong> for conducting independent family due diligence, police verification, reference checks, and financial inquiry before solemnizing any Nikah.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-amber-200 dark:border-amber-800/60 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <button
                      type="button"
                      onClick={() => setLegalModalTab('terms')}
                      className="hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      Read Terms of Service
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setLegalModalTab('privacy')}
                      className="hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Shield className="w-3 h-3" />
                      Read Privacy Policy
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setLegalModalTab('refund')}
                      className="hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Gavel className="w-3 h-3" />
                      Refund Policy
                    </button>
                  </div>
                </div>

                {/* Mandatory Legal & KYC Liability Waiver Checkbox (Hard Block, Un-ticked by default) */}
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-300 dark:border-zinc-800 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="signup-legal-consent"
                    checked={legalConsent}
                    onChange={(e) => setLegalConsent(e.target.checked)}
                    className="mt-1 accent-emerald-600 w-4 h-4 rounded cursor-pointer shrink-0"
                    required
                  />
                  <label htmlFor="signup-legal-consent" className="text-xs text-zinc-800 dark:text-zinc-200 leading-snug cursor-pointer">
                    <strong>I have read, understood, and agree to the Terms of Service, Privacy Policy, and Zero-Liability Platform Disclaimer.</strong> I explicitly acknowledge and agree that DaheejFree and its operators are not responsible or liable for any user behavior, background authenticity, offline interactions, financial losses, or matrimonial outcomes.
                  </label>
                </div>

                {/* Submit Button - completely disabled until legal consent checkbox is checked */}
                <button
                  id="btn-submit-signup"
                  type="submit"
                  disabled={isLoading || !legalConsent}
                  className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
                    !legalConsent
                      ? 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed opacity-50 shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-700/20 dark:shadow-emerald-950 hover:scale-[1.01] cursor-pointer'
                  }`}
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Complete Registration & Accept Terms</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Already have an account */}
              <div className="text-center pt-2">
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateLogin) onNavigateLogin();
                      else router.push('/login');
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </>
          )}

          {/* Inline Legal Policies Modal */}
          {legalModalTab && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
              <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-base">
                    <Shield className="w-5 h-5 text-emerald-600" />
                    <span>DaheejFree Statutory Legal Policies & Zero-Liability Terms</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLegalModalTab(null)}
                    className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <LegalPolicies initialTab={legalModalTab} onBack={() => setLegalModalTab(null)} />
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setLegalConsent(true);
                      setLegalModalTab(null);
                    }}
                    className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm"
                  >
                    I Understand & Agree to Terms
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Google Fast Registration Modal */}
          <GoogleFastRegisterModal
            isOpen={Boolean(googleUser)}
            onClose={() => setGoogleUser(null)}
            googleUser={googleUser}
            onSuccess={(newUserId) => {
              switchUser(newUserId);
              router.refresh();
              if (onSuccess) onSuccess(newUserId);
              else router.push('/matches');
            }}
          />
        </div>
      </div>
    </div>
  );
}
