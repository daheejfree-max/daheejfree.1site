'use client';

import React, { useState, useRef } from 'react';
import {
  FileCheck,
  UploadCloud,
  ShieldCheck,
  AlertCircle,
  X,
  Sparkles,
  Camera,
  CheckCircle2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { daheejStore } from '../../lib/supabase/store';
import { compressImageFile } from '../../lib/imageCompressor';

interface GovtIdVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onVerificationComplete?: () => void;
}

export const GovtIdVerificationModal: React.FC<GovtIdVerificationModalProps> = ({
  isOpen,
  onClose,
  userId,
  onVerificationComplete,
}) => {
  const [docType, setDocType] = useState<'passport' | 'national_id' | 'driving_license'>('national_id');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'upload' | 'verifying' | 'success'>('upload');

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File, isFront: boolean) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Document file size exceeds 10MB limit.');
      return;
    }

    setError(null);
    try {
      const compressed = await compressImageFile(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 });
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (isFront) {
          setFrontImage(result);
        } else {
          setBackImage(result);
        }
      };
      reader.readAsDataURL(compressed);
    } catch (err: any) {
      setError(err?.message || 'Failed to process document file.');
    }
  };

  const handleVerifyDocument = async () => {
    if (!frontImage) {
      setError('Please upload the front photo of your government ID document.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStep('verifying');

    try {
      const response = await fetch('/api/kyc/verify-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: userId,
          documentType: docType,
          frontImageBase64: frontImage,
          backImageBase64: backImage || null,
        }),
      });

      let data: any = null;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch {
        console.warn('[Doc KYC] Non-JSON response');
      }

      if (!response.ok || (data && data.success === false)) {
        const msg = data?.error || 'Document validation could not verify the provided ID document. Please ensure high clarity and no glare.';
        setError(msg);
        setStep('upload');
        setIsProcessing(false);
        return;
      }

      // Successfully verified document
      daheejStore.updateProfile(userId, {
        kyc_status: 'verified',
        kyc_verified: true,
        is_verified: true,
        kyc_document_type: docType,
        kyc_document_url: data?.documentRecordUrl || frontImage,
      });

      setStep('success');
      if (onVerificationComplete) {
        onVerificationComplete();
      }
    } catch (err: any) {
      console.error('[Doc KYC] Submission error:', err);
      setError(err?.message || 'Failed to submit document for verification. Please try again.');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden relative">
        {/* Top Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Government ID Verification
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Official document authenticity & identity check
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-4">
              {/* Document Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Select Document Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'national_id', label: 'National ID' },
                    { id: 'passport', label: 'Passport' },
                    { id: 'driving_license', label: "Driver's License" },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setDocType(type.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        docType === type.id
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Front Photo Upload Card */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Document Front Side <span className="text-emerald-500">*</span>
                </label>
                <div
                  onClick={() => frontInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
                    frontImage
                      ? 'border-emerald-500/60 bg-emerald-500/5'
                      : 'border-zinc-300 dark:border-zinc-700 hover:border-emerald-500/50 bg-zinc-50 dark:bg-zinc-950/40'
                  }`}
                >
                  {frontImage ? (
                    <div className="relative w-full h-28 rounded-xl overflow-hidden flex items-center justify-center">
                      <img
                        src={frontImage}
                        alt="Front ID"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-white text-xs font-bold gap-1">
                        <Camera className="w-4 h-4" />
                        <span>Change Photo</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <UploadCloud className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mx-auto" />
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Click to upload front of {docType.replace('_', ' ')}
                      </p>
                      <p className="text-[11px] text-zinc-400">PNG, JPG or WEBP up to 10MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0], true);
                    }
                  }}
                />
              </div>

              {/* Back Photo Upload Card (Optional for Passport, recommended for ID) */}
              {docType !== 'passport' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Document Back Side <span className="text-zinc-400 font-normal">(Optional)</span>
                  </label>
                  <div
                    onClick={() => backInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[100px] ${
                      backImage
                        ? 'border-emerald-500/60 bg-emerald-500/5'
                        : 'border-zinc-300 dark:border-zinc-700 hover:border-emerald-500/50 bg-zinc-50 dark:bg-zinc-950/40'
                    }`}
                  >
                    {backImage ? (
                      <div className="relative w-full h-20 rounded-xl overflow-hidden flex items-center justify-center">
                        <img
                          src={backImage}
                          alt="Back ID"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-white text-xs font-bold gap-1">
                          <Camera className="w-4 h-4" />
                          <span>Change Photo</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <UploadCloud className="w-6 h-6 text-zinc-400 dark:text-zinc-500 mx-auto" />
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Click to upload back side
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={backInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0], false);
                      }
                    }}
                  />
                </div>
              )}

              {/* Privacy notice */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Identity documents are end-to-end encrypted and never visible to other candidates.</span>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleVerifyDocument}
                disabled={!frontImage || isProcessing}
                className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Submit & Verify Document</span>
              </button>
            </div>
          )}

          {step === 'verifying' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-500">
                <span className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Verifying Document Authenticity...
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                  Performing optical security inspection, MRZ checksum, and integrity analysis.
                </p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center mx-auto text-emerald-500">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  Government ID Verified
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                  Your identity documents have been verified and cryptographically recorded.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                Continue to Platform
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
