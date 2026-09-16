'use client';

// ==============================================================================
// MANDATORY MATRIMONIAL ONBOARDING FORM (Asking Details & Dowry-Free Pledge)
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  User,
  Heart,
  Briefcase,
  MapPin,
  Phone,
  Scale,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Camera,
  UploadCloud,
  X,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { useRouter } from '../../hooks/useRouter';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { Gender, Profile, IslamicSect, PreferredSect } from '../../types';
import { compressImageFile } from '../../lib/imageCompressor';

export type { IslamicSect, PreferredSect };

interface OnboardingPageProps {
  onSuccess?: () => void;
}

export default function OnboardingPage({ onSuccess }: OnboardingPageProps) {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [gender, setGender] = useState<Gender>('female');
  const [age, setAge] = useState<number>(24);
  const [profession, setProfession] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [sect, setSect] = useState<IslamicSect>('Sunni');
  const [preferredSect, setPreferredSect] = useState<PreferredSect>('Any');
  const [waliName, setWaliName] = useState<string>('');
  const [waliPhone, setWaliPhone] = useState<string>('');
  const [waliEmail, setWaliEmail] = useState<string>('');
  const [antiDowryPledge, setAntiDowryPledge] = useState<boolean>(true);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(true);
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    // Pre-populate with existing authenticated session data
    async function loadSession() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
        setUserEmail(data.user.email || '');
        const metaName =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split('@')[0] ||
          '';
        if (metaName) setFullName(metaName);

        // Check if profile exists in store
        const existing = daheejStore.getProfileById(data.user.id);
        if (existing) {
          if (existing.full_name) setFullName(existing.full_name);
          if (existing.gender) setGender(existing.gender);
          if (existing.age) setAge(existing.age);
          if (existing.profession) setProfession(existing.profession);
          if (existing.location || existing.city) setCity(existing.location || existing.city || '');
          if (existing.sect) {
            setSect(existing.sect);
          } else if (existing.religious_sect) {
            const low = existing.religious_sect.toLowerCase();
            if (low.includes('shia')) setSect('Shia');
            else if (low.includes('just')) setSect('Just Muslim');
            else if (low.includes('other')) setSect('Other');
            else setSect('Sunni');
          }
          if (existing.preferred_sect) setPreferredSect(existing.preferred_sect);
          if (existing.wali_name) setWaliName(existing.wali_name);
          if (existing.wali_phone) setWaliPhone(existing.wali_phone);
          if (existing.avatar_url) setAvatarPreview(existing.avatar_url);
        }
      } else {
        const localUid = daheejStore.getCurrentUserId();
        if (localUid) {
          setUserId(localUid);
          const existing = daheejStore.getProfileById(localUid);
          if (existing) {
            if (existing.full_name) setFullName(existing.full_name);
            if (existing.gender) setGender(existing.gender);
            if (existing.age) setAge(existing.age);
            if (existing.profession) setProfession(existing.profession);
            if (existing.location || existing.city) setCity(existing.location || existing.city || '');
            if (existing.sect) {
              setSect(existing.sect);
            } else if (existing.religious_sect) {
              const low = existing.religious_sect.toLowerCase();
              if (low.includes('shia')) setSect('Shia');
              else if (low.includes('just')) setSect('Just Muslim');
              else if (low.includes('other')) setSect('Other');
              else setSect('Sunni');
            }
            if (existing.preferred_sect) setPreferredSect(existing.preferred_sect);
            if (existing.wali_name) setWaliName(existing.wali_name);
            if (existing.wali_phone) setWaliPhone(existing.wali_phone);
            if (existing.avatar_url) setAvatarPreview(existing.avatar_url);
          }
        }
      }
    }
    loadSession();
  }, []);

  const handlePhotoSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }
    setError(null);
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Strict Form Validation
    if (gender === 'male' && age < 21) {
      const msg = '⚠️ Minimum age eligibility for grooms is 21 years.';
      setAgeError(msg);
      setError(msg);
      return;
    }
    if (gender === 'female' && age < 18) {
      const msg = '⚠️ Minimum age eligibility for brides is 18 years.';
      setAgeError(msg);
      setError(msg);
      return;
    }
    setAgeError(null);

    if (!avatarFile && !avatarPreview) {
      setError('Profile photo is strictly mandatory. Please upload an avatar photo before submitting your onboarding details.');
      return;
    }

    if (!profession.trim() || !city.trim() || !waliName.trim() || !waliPhone.trim()) {
      setError('Please fill out all required fields.');
      return;
    }

    if (!sect) {
      setError('Please select your Islamic Sect.');
      return;
    }

    if (!preferredSect) {
      setError('Please select your Preferred Partner Sect.');
      return;
    }

    if (!antiDowryPledge) {
      setError('You must sign and accept the Islamic Anti-Dowry (Bila-Daheej) Charter to proceed.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Obtain authentic user identity
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Onboarding Save Error:', authError);
      }
      const user = authData?.user;
      const activeId = user?.id || userId || daheejStore.getCurrentUserId();

      if (!activeId) {
        throw new Error('User session not found. Please sign in again.');
      }

      // 2. Upload Avatar to Supabase Storage 'avatars' bucket
      let uploadedAvatarUrl = avatarPreview || '';

      if (avatarFile) {
        setIsUploadingPhoto(true);
        try {
          const compressedBlob = await compressImageFile(avatarFile, { maxWidth: 800, maxHeight: 800, quality: 0.8 });
          const fileExt = 'jpg';
          const filePath = `${activeId}/avatar_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, compressedBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadError) {
            console.warn('[Supabase Storage] Upload notice, using base64 preview:', uploadError.message);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(filePath);

            if (publicUrlData?.publicUrl) {
              uploadedAvatarUrl = publicUrlData.publicUrl;
            }
          }
        } catch (storageErr) {
          console.warn('[Supabase Storage] Storage exception handled:', storageErr);
        } finally {
          setIsUploadingPhoto(false);
        }
      }

      if (!termsAccepted || !privacyAccepted || !antiDowryPledge) {
        throw new Error('You must accept the Terms of Service, Privacy Policy, and Anti-Dowry Charter to proceed.');
      }

      if (!uploadedAvatarUrl) {
        throw new Error('Please select and upload a valid profile photo.');
      }

      // Upsert payload exactly matching requirements
      const payload = {
        id: activeId,
        full_name: fullName.trim() || user?.user_metadata?.full_name || 'User',
        gender: gender,
        age: Number(age) || 24,
        profession: profession.trim(),
        city: city.trim(),
        location: city.trim(),
        sect: sect,
        preferred_sect: preferredSect,
        religious_sect: sect,
        wali_name: waliName.trim(),
        wali_phone: waliPhone.trim(),
        wali_email: waliEmail.trim() || user?.email || userEmail || `${activeId}@daheejfree.site`,
        avatar_url: uploadedAvatarUrl,
        terms_accepted: true,
        privacy_policy_accepted: true,
        anti_dowry_pledged: true,
        is_onboarded: true,
        photo_privacy: true,
        updated_at: new Date().toISOString(),
      };

      // 3. Supabase Upsert Call
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

      // Explicit update to guarantee legal consent flags
      await supabase
        .from('profiles')
        .update({
          terms_accepted: true,
          privacy_policy_accepted: true,
          anti_dowry_pledged: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeId);

      if (upsertError) {
        console.error('Onboarding Save Error:', upsertError);
        setError(upsertError.message || 'Failed to save profile. Please check database permissions.');
        setIsSubmitting(false);
        return;
      }

      // 4. Synchronize local store profile state
      const localProfilePayload: Partial<Profile> & { city: string; is_onboarded: boolean } = {
        id: activeId,
        full_name: payload.full_name,
        gender,
        age: payload.age,
        profession: payload.profession,
        location: payload.city,
        city: payload.city,
        sect: sect,
        preferred_sect: preferredSect,
        religious_sect: sect,
        wali_name: payload.wali_name,
        wali_phone: payload.wali_phone,
        wali_email: waliEmail.trim() || user?.email || userEmail || `${activeId}@daheejfree.site`,
        anti_dowry_pledged: true,
        is_onboarded: true,
        kyc_status: 'pending',
        subscription_tier: 'free',
        avatar_url: uploadedAvatarUrl,
        photo_privacy: true,
        updated_at: new Date().toISOString(),
      };

      const existing = daheejStore.getProfileById(activeId);
      if (existing) {
        daheejStore.updateProfile(activeId, localProfilePayload);
      } else {
        daheejStore.createProfile({
          ...(localProfilePayload as Profile),
          created_at: new Date().toISOString(),
        });
      }

      daheejStore.setCurrentUserId(activeId);

      // 5. Guaranteed success redirect
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/matches');
      }
    } catch (err: unknown) {
      console.error('Onboarding Save Error:', err);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred while saving your profile.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 text-zinc-900 dark:text-zinc-100 flex flex-col justify-center transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* Header Badge */}
        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Mandatory Profile Setup
          </span>
        </div>

        <h2 className="text-center text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          Complete Your Matrimonial Profile
        </h2>
        <p className="mt-2 text-center text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
          In adherence to Shariah principles and our anti-dowry charter, please provide your matrimonial and guardian details to unlock verified matches.
        </p>

        <div className="mt-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-8 px-6 sm:px-10 rounded-3xl shadow-xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Profile Picture Upload Section (MANDATORY) */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Profile Photo (Supabase Storage)
                  <span className="text-red-500 font-bold ml-1">* Mandatory</span>
                </label>
                {isUploadingPhoto && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative group w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-500 bg-white dark:bg-zinc-900 flex items-center justify-center flex-shrink-0 shadow-md">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-400">
                      <Camera className="w-8 h-8 text-emerald-500 mb-1" />
                      <span className="text-[10px] font-medium">Add Photo</span>
                    </div>
                  )}

                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-10">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                      <span className="text-[9px] mt-1 font-bold">Uploading</span>
                    </div>
                  )}

                  {avatarFile && !isUploadingPhoto && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview(null);
                      }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white shadow hover:bg-red-500 cursor-pointer z-10"
                      title="Remove photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handlePhotoSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      disabled={isUploadingPhoto || isSubmitting}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      {isUploadingPhoto ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                      <span>{avatarPreview ? 'Change Photo' : 'Upload Avatar *'}</span>
                    </button>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      JPEG, PNG or WEBP (Max 5MB)
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
                    🔒 Photo Privacy enabled: Photos stay blurred in searches until mutual match acceptance.
                  </p>
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Full Name (Legal / Preferred)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Fatima Zahra or Ahmed Siddiqui"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Gender & Age Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Gender
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenderChange('female')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      gender === 'female'
                        ? 'bg-pink-50 dark:bg-pink-950/60 border-pink-400 text-pink-700 dark:text-pink-300'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Sister (Bride)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenderChange('male')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      gender === 'male'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Brother (Groom)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Age (Years)
                </label>
                <input
                  type="number"
                  min={gender === 'male' ? 21 : 18}
                  max="70"
                  required
                  value={age}
                  onChange={(e) => handleAgeChange(Number(e.target.value))}
                  className={`w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 transition-colors ${
                    ageError
                      ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-zinc-200 dark:border-zinc-800 focus:ring-emerald-500/20 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>
            {ageError && (
              <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-[11px] text-red-700 dark:text-red-300 font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                <span>{ageError}</span>
              </div>
            )}

            {/* Profession & City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Profession / Occupation
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="e.g. Software Engineer, Doctor"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <Briefcase className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  City / Location
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Hyderabad, TS"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <MapPin className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                </div>
              </div>
            </div>

            {/* Islamic Sectarian Affiliation & Preferred Partner Sect */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white">
                <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Islamic Background & Sectarian Preferences</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                To foster marital understanding and respect between families, please specify your tradition and preferences.
              </p>

              {/* Field 1: Your Islamic Sect */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  Your Islamic Sect <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: 'Sunni', label: 'Sunni', desc: 'Ahlus Sunnah wal Jamaah' },
                    { value: 'Shia', label: 'Shia', desc: "Ja'fari / Ahlul Bayt" },
                    { value: 'Just Muslim', label: 'Just Muslim', desc: 'Non-sectarian Quran & Sunnah' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSect(item.value as IslamicSect)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                        sect === item.value
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold">{item.label}</span>
                        {sect === item.value && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 2: Preferred Partner Sect */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  Preferred Partner Sect <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: 'Any', label: 'Any Sect', desc: 'Open to All Muslims' },
                    { value: 'Sunni', label: 'Sunni', desc: 'Sunni Match Only' },
                    { value: 'Shia', label: 'Shia', desc: 'Shia Match Only' },
                    { value: 'Just Muslim', label: 'Just Muslim', desc: 'Non-sectarian' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setPreferredSect(item.value as PreferredSect)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                        preferredSect === item.value
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold">{item.label}</span>
                        {preferredSect === item.value && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Guardian (Wali) Details */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white">
                <Scale className="w-4 h-4 text-amber-500" />
                <span>Guardian (Wali / Representative) Details</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                To protect our sisters and maintain dignity, Wali contact information is strictly required.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Wali Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={waliName}
                    onChange={(e) => setWaliName(e.target.value)}
                    placeholder="e.g. Mohammed Ali (Father)"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Wali Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={waliPhone}
                      onChange={(e) => setWaliPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <Phone className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Wali Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={waliEmail}
                    onChange={(e) => setWaliEmail(e.target.value)}
                    placeholder="wali@domain.com"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Anti-Dowry Solemn Pledge Checkbox */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  id="checkbox-anti-dowry"
                  type="checkbox"
                  checked={antiDowryPledge}
                  onChange={(e) => setAntiDowryPledge(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Solemn Anti-Dowry (Bila-Daheej) Charter</span>
                  </div>
                  <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
                    I solemnly testify before Allah (SWT) that neither I nor my family will demand, give, or entertain any form of dowry (Daheej/Jahez), cash demands, or lavish un-Islamic expectations.
                  </p>
                </div>
              </label>
            </div>

            {/* Mandatory Legal Agreements: Terms of Service & Privacy Policy */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Mandatory Legal Agreements</span>
              </div>
              
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  id="checkbox-terms-accepted"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                />
                <span className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-tight">
                  I agree to the <strong className="text-emerald-600 dark:text-emerald-400">Terms of Service</strong> governing sacred Islamic matrimonial intentions, Wali representation, and community safety.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  id="checkbox-privacy-accepted"
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                />
                <span className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-tight">
                  I agree to the <strong className="text-emerald-600 dark:text-emerald-400">Privacy Policy</strong>, including 2-way gated photo consent and biometric identity verification safeguards.
                </span>
              </label>
            </div>

            {/* Prominent Error Alert Banner Above Submit */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              id="btn-submit-onboarding"
              type="submit"
              disabled={isSubmitting || !antiDowryPledge || !termsAccepted || !privacyAccepted}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <span>Registering Profile & Charter...</span>
              ) : (
                <>
                  <span>Accept Agreements & Save Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
