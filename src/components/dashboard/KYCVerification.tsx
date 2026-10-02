'use client';

// ==============================================================================
// KYC IDENTITY VERIFICATION & PROFILE SETTINGS (DIDIT.ME + SUPABASE STORAGE)
// ==============================================================================

import React, { useState, useRef } from 'react';
import {
  Shield,
  CheckCircle,
  UploadCloud,
  FileCheck,
  Lock,
  User,
  Mail,
  HeartHandshake,
  AlertCircle,
  Eye,
  EyeOff,
  Camera,
  ExternalLink,
  Crown,
  Sparkles,
  Calendar,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  BadgeCheck,
  Globe,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { Profile, SubscriptionTier } from '../../types';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { AIBioAssistantModal } from '../ai/AIBioAssistantModal';
import { LanguageSelector } from '../common/LanguageSelector';
import { compressImageFile } from '../../lib/imageCompressor';
import { KycVerifyButton } from '../KycVerifyButton';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Smartphone } from 'lucide-react';

interface KYCVerificationProps {
  profile: Profile | null;
  tier: SubscriptionTier;
  onUpdateProfile: (updates: Partial<Profile>) => void;
  onSubmitKYC: (docType: string) => void;
  onOpenPricing: () => void;
  onAccountDeleted?: () => void;
}

export const KYCVerification: React.FC<KYCVerificationProps> = ({
  profile,
  tier,
  onUpdateProfile,
  onSubmitKYC,
  onOpenPricing,
  onAccountDeleted,
}) => {
  const { isInstalled } = usePWAInstall();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [waliEmail, setWaliEmail] = useState(profile?.wali_email || '');
  const [waliName, setWaliName] = useState(profile?.wali_name || '');
  const [waliPhone, setWaliPhone] = useState(profile?.wali_phone || '');
  const [profession, setProfession] = useState(profile?.profession || '');
  const [location, setLocation] = useState(profile?.location || profile?.city || '');
  const [education, setEducation] = useState(profile?.education || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [prayerFrequency, setPrayerFrequency] = useState(profile?.prayer_frequency || 'Regular 5 Daily Prayers');
  const [photoPrivacyMode, setPhotoPrivacyMode] = useState<'blur_all' | 'liked_only' | 'public'>(
    profile?.photo_privacy_mode || (profile?.photo_privacy === false ? 'public' : 'liked_only')
  );

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadSuccess, setPhotoUploadSuccess] = useState(false);
  const [isStartingDidit, setIsStartingDidit] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [diditError, setDiditError] = useState<string | null>(null);
  const [diditSessionUrl, setDiditSessionUrl] = useState<string | null>(profile?.didit_session_url || null);

  // Modals
  const [isAIBioModalOpen, setIsAIBioModalOpen] = useState(false);

  // Account Deletion States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!profile) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<Profile> = {
      full_name: fullName,
      nickname,
      wali_email: waliEmail,
      wali_name: waliName,
      wali_phone: waliPhone,
      profession,
      location,
      city: location,
      education,
      bio,
      prayer_frequency: prayerFrequency,
      photo_privacy_mode: photoPrivacyMode,
      photo_privacy: photoPrivacyMode !== 'public',
    };

    onUpdateProfile(updates);
    daheejStore.updateProfile(profile.id, updates);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo size exceeds 5MB limit.');
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoUploadSuccess(false);

    try {
      const compressedBlob = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.8 });
      const fileExt = 'jpg';
      const filePath = `${profile.id}/avatar_${Date.now()}.${fileExt}`;

      let publicUrl = '';

      // Upload to Supabase Storage 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedBlob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        if (urlData?.publicUrl) {
          publicUrl = urlData.publicUrl;
        }
      }

      // Fallback base64 or instant preview if storage is in test mode
      if (!publicUrl) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64Url = reader.result as string;
          onUpdateProfile({ avatar_url: base64Url });
          daheejStore.updateProfile(profile.id, { avatar_url: base64Url });
        };
        reader.readAsDataURL(file);
      } else {
        onUpdateProfile({ avatar_url: publicUrl });
        daheejStore.updateProfile(profile.id, { avatar_url: publicUrl });
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
      }

      setPhotoUploadSuccess(true);
      setTimeout(() => setPhotoUploadSuccess(false), 3000);
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Phase 3: Initiate Didit.me KYC Session
  const handleStartDiditKYC = async () => {
    setIsStartingDidit(true);
    setDiditError(null);

    try {
      const res = await fetch('/api/kyc/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          profileId: profile.id,
          returnUrl: window.location.href,
        }),
      });

      let data: any = null;
      try {
        const responseText = await res.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        console.warn('[KYCVerification] Non-JSON response received from verify endpoint');
      }

      const sessionUrl = data?.url || data?.sessionUrl || data?.session_url || data?.verification_url;
      const sessionId = data?.sessionId || data?.session_id || `session_${Date.now()}`;

      if (sessionUrl) {
        setDiditSessionUrl(sessionUrl);
        daheejStore.updateProfile(profile.id, {
          kyc_session_id: sessionId,
          didit_session_url: sessionUrl,
          kyc_status: 'pending',
        });
        onUpdateProfile({
          kyc_session_id: sessionId,
          didit_session_url: sessionUrl,
          kyc_status: 'pending',
        });

        // Open Didit verification in same tab to prevent popup blockers
        window.location.href = sessionUrl;
      } else {
        setDiditError(data?.error || data?.message || 'Failed to initiate Didit session. Please try again later.');
      }
    } catch (err: any) {
      console.error('Didit KYC error:', err);
      setDiditError(err.message || 'Unable to connect to Didit gateway. Please check your network or server configuration.');
    } finally {
      setIsStartingDidit(false);
    }
  };

  // Phase 3 Fallback: Refresh Verification Status from public.profiles
  const handleRefreshKYCStatus = async () => {
    setIsRefreshingStatus(true);
    setDiditError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('kyc_verified, kyc_status, id_verified, selfie_verified, is_verified')
        .eq('id', profile.id)
        .single();

      if (error) {
        console.warn('[KYCVerification] Supabase refresh warning:', error);
      }

      const isVerified =
        data?.kyc_verified === true ||
        data?.kyc_status === 'verified' ||
        data?.is_verified === true;

      if (isVerified) {
        const verifiedUpdates: Partial<Profile> = {
          kyc_verified: true,
          kyc_status: 'verified',
          is_verified: true,
          id_verified: true,
          selfie_verified: true,
        };
        daheejStore.updateProfile(profile.id, verifiedUpdates);
        onUpdateProfile(verifiedUpdates);
      } else {
        const currentStatus = data?.kyc_status || 'pending';
        setDiditError(`Status: ${currentStatus.replace('_', ' ').toUpperCase()}. If you just finished verification on Didit, please allow a moment for gateway synchronization.`);
      }
    } catch (err: any) {
      setDiditError(err?.message || 'Unable to refresh status.');
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Overview Card with Photo Management */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Picture with Supabase Storage Uplink */}
          <div className="relative group w-32 h-32 rounded-3xl overflow-hidden border-2 border-emerald-500 bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center flex-shrink-0 shadow-lg">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-14 h-14 text-emerald-600 dark:text-emerald-400" />
            )}

            {/* Hover overlay to change avatar */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
            >
              <Camera className="w-5 h-5 text-emerald-400" />
              <span>{isUploadingPhoto ? 'Uploading...' : 'Change Photo'}</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handlePhotoUpload(e.target.files[0]);
              }
            }}
          />

          <div className="flex-1 text-center sm:text-left space-y-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white">{profile.full_name}</h2>
              
              {profile.kyc_status === 'verified' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600 shadow-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Verified Member
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-600/40">
                  <Shield className="w-3.5 h-3.5" />
                  KYC Pending
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {profile.gender === 'female' ? 'Sister (Bride Profile)' : 'Brother (Groom Profile)'} • Account ID:{' '}
              <span className="font-mono text-zinc-500 dark:text-zinc-400">{profile.id.slice(0, 8)}...</span>
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                Plan: <strong className="text-emerald-700 dark:text-emerald-400 uppercase">{tier}</strong>
              </span>
              <button
                onClick={onOpenPricing}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
              >
                Manage Subscription (7-Day Trial)
              </button>
            </div>

            {photoUploadSuccess && (
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 animate-in fade-in">
                ✓ Photo successfully uploaded to Supabase Storage!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* INSTALL APP (PWA) SECTION - Suppressed when already installed */}
      {!isInstalled && (
        <div className="bg-white dark:bg-zinc-900 border border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl transition-colors space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-sm shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    Install DaheejFree as an App
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                    Native PWA
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Install on your Android, iPhone, iPad, or desktop computer for 1-tap launching and offline access.
                </p>
              </div>
            </div>
            <div className="sm:shrink-0">
              <PWAInstallButton variant="hero" />
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL LANGUAGE & TRANSLATION SETTINGS */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl transition-colors space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-sm">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Language & Regional Localization / زبان اور خطہ
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Select your preferred language with full multilingual translation support (135+ languages).
            </p>
          </div>
        </div>

        <div className="pt-2">
          <LanguageSelector variant="full" />
        </div>
      </div>

      {/* PHASE 3: DIDIT.ME KYC VERIFICATION MODULE */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl transition-colors space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-sm">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Didit.me KYC Identity Verification</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Government ID verification & biometric liveness to safeguard marriage candidates
              </p>
            </div>
          </div>

          <div>
            {profile.kyc_status === 'verified' ? (
              <span className="px-4 py-1.5 rounded-full text-xs font-extrabold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-400 dark:border-emerald-600 flex items-center gap-1.5 shadow-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Verified via Didit.me
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/40">
                Verification Incomplete
              </span>
            )}
          </div>
        </div>

        {profile.kyc_status === 'verified' ? (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-3">
            <FileCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">Didit.me Verification Complete</p>
              <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">
                Your government document and facial liveness check have been verified. Your profile displays the green shield badge across the entire platform.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5" />
                <span>Privacy-First Decentralized Identity (Didit Protocol)</span>
              </div>
              <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside">
                <li><strong>Zero Raw ID Storage:</strong> We never store unencrypted PII, passports, or ID card photos on our servers.</li>
                <li><strong>Decentralized Verification:</strong> Identity and biometric liveness are cryptographically verified through Didit's secure portal.</li>
                <li><strong>Anti-Dowry Trust:</strong> Verified badges confirm candidate authenticity while strictly eliminating fake profiles and bots.</li>
              </ul>
            </div>

            {diditError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{diditError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <KycVerifyButton
                id="btn-didit-verify"
                userId={profile.id}
                profileId={profile.id}
                className="px-6 py-3.5 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                onError={(err) => setDiditError(err)}
              >
                <Shield className="w-5 h-5 text-white" />
                <span>Start Government ID Verification</span>
                <ExternalLink className="w-4 h-4 opacity-80" />
              </KycVerifyButton>

              <button
                id="btn-didit-refresh"
                type="button"
                onClick={handleRefreshKYCStatus}
                disabled={isRefreshingStatus}
                className="px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
                <span>Check Verification Status</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PHOTO PRIVACY & VISIBILITY CONTROLS */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl transition-colors space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
            {photoPrivacyMode === 'public' ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Photo Privacy & Haya Controls</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Configure how candidates of the opposite gender view your picture
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setPhotoPrivacyMode('liked_only');
              onUpdateProfile({ photo_privacy_mode: 'liked_only', photo_privacy: true });
              daheejStore.updateProfile(profile.id, { photo_privacy_mode: 'liked_only', photo_privacy: true });
            }}
            className={`p-4 rounded-2xl border text-left transition-all ${
              photoPrivacyMode === 'liked_only'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-200 shadow-sm'
                : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <div className="font-bold text-xs flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Mutual Match Only
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Photo is blurred in search; automatically revealed only when a match is accepted.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPhotoPrivacyMode('blur_all');
              onUpdateProfile({ photo_privacy_mode: 'blur_all', photo_privacy: true });
              daheejStore.updateProfile(profile.id, { photo_privacy_mode: 'blur_all', photo_privacy: true });
            }}
            className={`p-4 rounded-2xl border text-left transition-all ${
              photoPrivacyMode === 'blur_all'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-200 shadow-sm'
                : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <div className="font-bold text-xs flex items-center gap-1.5 mb-1">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Strict Consent Gated
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Always blurred until you explicitly grant individual photo reveal permission.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPhotoPrivacyMode('public');
              onUpdateProfile({ photo_privacy_mode: 'public', photo_privacy: false });
              daheejStore.updateProfile(profile.id, { photo_privacy_mode: 'public', photo_privacy: false });
            }}
            className={`p-4 rounded-2xl border text-left transition-all ${
              photoPrivacyMode === 'public'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-200 shadow-sm'
                : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <div className="font-bold text-xs flex items-center gap-1.5 mb-1">
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              Public to Verified
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Clear photo visible immediately to all verified matrimonial candidates.
            </p>
          </button>
        </div>
      </div>

      {/* EDIT PROFILE & WALI INFORMATION */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl transition-colors">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Edit Matrimonial Profile & Wali</h3>

        {savedSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 text-xs text-emerald-800 dark:text-emerald-200 font-semibold animate-in fade-in">
            ✓ Profile details successfully updated!
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Full Legal Name:
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Public Nickname / Halal Handle:
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Sister Zainab or Brother Farhan"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Location / City:
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Prayer (Salah) Frequency:
              </label>
              <select
                value={prayerFrequency}
                onChange={(e) => setPrayerFrequency(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Regular 5 Daily Prayers">Regular 5 Daily Prayers (Always on time)</option>
                <option value="Usually 5 Daily Prayers">Usually 5 Daily Prayers (Practicing)</option>
                <option value="Friday Prayers & Striving">Friday Prayers & Striving for 5</option>
                <option value="Learning and Improving">Learning and Improving</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Guardian (Wali) Full Name:
              </label>
              <input
                type="text"
                value={waliName}
                onChange={(e) => setWaliName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Mohammed Ali (Father)"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Wali Phone Number:
              </label>
              <input
                type="tel"
                value={waliPhone}
                onChange={(e) => setWaliPhone(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Wali (Guardian) Email:
              </label>
              <input
                type="email"
                value={waliEmail}
                onChange={(e) => setWaliEmail(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                placeholder="wali@example.com"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Profession / Occupation:
              </label>
              <input
                type="text"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Education & Qualifications:
              </label>
              <input
                type="text"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Matrimonial Bio & Values:
                </label>
                <button
                  type="button"
                  onClick={() => setIsAIBioModalOpen(true)}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800/50 shadow-xs cursor-pointer hover:scale-105 transition-transform"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Generate AI Halal Bio
                </button>
              </div>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your religious values, marital expectations, and personality..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-md cursor-pointer"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>

      {/* PHASE 5: DANGER ZONE - HARD DELETE ACCOUNT */}
      <div className="bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 sm:p-8 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-950 dark:text-rose-200">
                Danger Zone: Delete Account
              </h3>
              <p className="text-xs text-rose-900/80 dark:text-rose-300/80 max-w-xl leading-relaxed">
                Permanently delete your matrimonial profile from the database, purge uploaded avatar photos from Supabase Storage, cancel subscriptions, and revoke your Supabase authentication session. This action cannot be undone.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-open-delete-account-modal"
            onClick={() => {
              setDeleteConfirmText('');
              setDeleteError(null);
              setIsDeleteModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2 flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>

      {/* DELETE CONFIRMATION DIALOG */}
      {isDeleteModalOpen && (
        <div
          id="delete-confirmation-dialog"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-900/80 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95">
            {/* Close Icon */}
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-dialog-title" className="text-lg font-bold text-zinc-900 dark:text-white">
                  Permanently Delete Account?
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                  Critical Warning: Irreversible Hard Deletion
                </p>
              </div>
            </div>

            {/* Deletion Scope Checklist */}
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
              <p className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                The following data will be permanently purged:
              </p>
              <ul className="space-y-1.5 list-disc pl-4 text-zinc-600 dark:text-zinc-400">
                <li>Your row from the <code className="text-rose-600 dark:text-rose-400">public.profiles</code> database table</li>
                <li>Your uploaded avatar images from Supabase Storage (<code className="text-rose-600 dark:text-rose-400">avatars</code> bucket)</li>
                <li>Didit.me KYC verification records & session identifiers</li>
                <li>All active match connections, consent requests, and chat logs</li>
                <li>Active membership subscriptions and autopay mappings</li>
                <li>Permanent revocation & deletion of your <strong>Supabase Auth</strong> account</li>
              </ul>
            </div>

            {/* Confirmation input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Type <strong className="text-rose-600 dark:text-rose-400 uppercase">DELETE</strong> to confirm permanent erasure:
              </label>
              <input
                type="text"
                id="input-delete-confirmation"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                disabled={isDeleting}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-account"
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                onClick={async () => {
                  if (deleteConfirmText !== 'DELETE') return;
                  setIsDeleting(true);
                  setDeleteError(null);

                  try {
                    // Get client IP if accessible
                    let clientIp = '127.0.0.1';
                    try {
                      const ipRes = await fetch('https://api.ipify.org?format=json').catch(() => null);
                      if (ipRes && ipRes.ok) {
                        const ipData = await ipRes.json();
                        if (ipData?.ip) clientIp = ipData.ip;
                      }
                    } catch (e) {
                      // fallback to default
                    }

                    // 1. Attempt Zero-Trust PostgreSQL RPC delete_user_account
                    let rpcSucceeded = false;
                    try {
                      const { error: rpcError } = await supabase.rpc('delete_user_account', {
                        p_reason: 'User self-deletion',
                      });
                      if (!rpcError) {
                        rpcSucceeded = true;
                        console.info('[Account Delete] Successfully executed delete_user_account RPC');
                      } else {
                        console.warn('[Account Delete] RPC notice:', rpcError);
                      }
                    } catch (rpcErr) {
                      console.warn('[Account Delete] RPC exception:', rpcErr);
                    }

                    // 2. Call server-side API to guarantee audit log archiving, relational cleanup, and Auth admin deletion
                    try {
                      await fetch('/api/account/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          profileId: profile.id,
                          clientIp,
                          reason: 'User self-deletion',
                        }),
                      });
                    } catch (apiErr) {
                      console.warn('[Account Delete] Server API notice:', apiErr);
                    }

                    // 3. Fallback direct client-side DB row cleanup if needed
                    if (!rpcSucceeded) {
                      try {
                        await supabase.from('profiles').delete().eq('id', profile.id);
                      } catch (dbErr) {
                        console.warn('[Account Delete] Direct DB delete notice:', dbErr);
                      }
                    }

                    // 4. Revoke Supabase authentication session
                    try {
                      await supabase.auth.signOut();
                    } catch (authErr) {
                      console.warn('[Account Delete] Supabase signout notice:', authErr);
                    }

                    // 5. Hard-delete from local reactive store, reset current session, and clear cached storage
                    daheejStore.deleteProfile(profile.id);
                    daheejStore.setCurrentUserId('');

                    if (typeof window !== 'undefined') {
                      try {
                        localStorage.clear();
                        sessionStorage.clear();
                      } catch (storageErr) {
                        console.warn('[Account Delete] Storage clear notice:', storageErr);
                      }
                    }

                    // 6. Notify parent and redirect to homepage with clean state
                    setIsDeleteModalOpen(false);
                    if (onAccountDeleted) {
                      onAccountDeleted();
                    } else {
                      window.location.href = '/?account_deleted=true';
                    }
                  } catch (err: any) {
                    console.error('[Account Delete] Deletion failed:', err);
                    setDeleteError(err?.message || 'Failed to complete account deletion. Please try again.');
                    setIsDeleting(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Permanently Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Permanently Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: AI Halal Bio & Icebreaker Generator */}
      <AIBioAssistantModal
        isOpen={isAIBioModalOpen}
        onClose={() => setIsAIBioModalOpen(false)}
        gender={profile.gender === 'male' ? 'male' : 'female'}
        initialProfession={profile.profession || ''}
        initialEducation={profile.education || ''}
        onApplyBio={(generatedBio) => {
          setBio(generatedBio);
          onUpdateProfile({ bio: generatedBio });
          daheejStore.updateProfile(profile.id, { bio: generatedBio });
        }}
      />
    </div>
  );
};
