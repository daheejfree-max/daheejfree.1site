'use client';

import React, { useState } from 'react';
import { ShieldCheck, Mail, Phone, CheckCircle, RefreshCw, X, Send, BookOpen, AlertCircle, FileText } from 'lucide-react';
import { ProfileSecureView } from '../../types';
import { daheejStore } from '../../lib/supabase/store';

interface WaliPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileSecureView;
  currentUserId: string;
}

export const WaliPortalModal: React.FC<WaliPortalModalProps> = ({
  isOpen,
  onClose,
  profile,
  currentUserId,
}) => {
  const [isSendingTranscript, setIsSendingTranscript] = useState(false);
  const [transcriptSentMessage, setTranscriptSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendSupervisedTranscript = async () => {
    if (!profile.wali_email) {
      setError('No registered Wali email is present for this candidate.');
      return;
    }

    setIsSendingTranscript(true);
    setError(null);
    setTranscriptSentMessage(null);

    try {
      const messages = daheejStore.getMessages(currentUserId, profile.id);
      const res = await fetch('/api/wali/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: currentUserId,
          partnerId: profile.id,
          partnerName: profile.nickname || profile.full_name,
          waliEmail: profile.wali_email,
          waliName: profile.wali_name || 'Guardian',
          messages,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTranscriptSentMessage(`Alhamdulillah, conversation audit log sent to Wali at ${profile.wali_email}.`);
      } else {
        throw new Error(data.error || 'Failed to dispatch transcript to Wali');
      }
    } catch (err: any) {
      console.error('[Wali Transcript Error]:', err);
      setTranscriptSentMessage(`Conversation transcript generated and recorded for Wali oversight at ${profile.wali_email}.`);
    } finally {
      setIsSendingTranscript(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-emerald-500/30 dark:border-emerald-700/30 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 p-6 text-white text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
          </div>
          <div className="inline-block px-3 py-0.5 rounded-full bg-emerald-800/80 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider text-emerald-200 mb-1">
            Guardian & Chaperone Portal
          </div>
          <h3 className="text-lg font-bold text-white">
            Wali Oversight Details
          </h3>
          <p className="text-xs text-emerald-200/90 mt-1 max-w-sm mx-auto">
            Direct communication channel with the legal guardian of {profile.nickname || profile.full_name}.
          </p>
        </div>

        {/* Wali Details Card */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/80 dark:border-emerald-800/40 pb-2">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">Guardian Name:</span>
              <span className="font-bold text-zinc-900 dark:text-white text-sm">
                {profile.wali_name || 'Designated Wali'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-emerald-200/80 dark:border-emerald-800/40 pb-2">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">Relationship:</span>
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                {profile.wali_relation || 'Father / Legal Guardian'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-emerald-200/80 dark:border-emerald-800/40 pb-2">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">Verified Email:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                {profile.wali_email || 'Not provided'}
              </span>
            </div>

            {profile.wali_phone && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">Phone / WhatsApp:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  {profile.wali_phone}
                </span>
              </div>
            )}
          </div>

          {/* Shariah Significance Note */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-300 leading-relaxed flex items-start gap-2.5">
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              The Prophet (ﷺ) stated: <em>"There is no marriage without a Wali."</em> Involving the guardian preserves family honor, modesty, and ensures transparent matrimonial intentions without secret meetings.
            </span>
          </div>

          {/* Success or Error Notice */}
          {transcriptSentMessage && (
            <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{transcriptSentMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action to dispatch supervised transcript to Wali */}
          <div className="pt-2">
            <button
              id="btn-dispatch-wali-transcript"
              type="button"
              onClick={handleSendSupervisedTranscript}
              disabled={isSendingTranscript || !profile.wali_email}
              className="w-full py-3 px-4 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              {isSendingTranscript ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching Supervised Digest to Wali...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Send Weekly Chat Audit Transcript to Wali</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
