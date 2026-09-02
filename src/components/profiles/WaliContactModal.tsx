'use client';

// ==============================================================================
// WALI (GUARDIAN) DIRECT COMMUNICATION MODAL (DIAMOND EXCLUSIVE)
// ==============================================================================

import React, { useState } from 'react';
import { Shield, Mail, Check, Copy, ExternalLink, X, HeartHandshake, UserCheck } from 'lucide-react';
import { ProfileSecureView, Profile } from '../../types';

interface WaliContactModalProps {
  targetProfile: ProfileSecureView | null;
  currentProfile: Profile | null;
  onClose: () => void;
}

export const WaliContactModal: React.FC<WaliContactModalProps> = ({
  targetProfile,
  currentProfile,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [message, setMessage] = useState('');

  // Update default message whenever target or current profile changes
  React.useEffect(() => {
    if (targetProfile) {
      const defaultMessage = `As-salamu alaykum wa rahmatullahi wa barakatuh,\n\nRespected Guardian (Wali),\n\nMy name is ${
        currentProfile?.full_name || 'a registered member'
      } (${currentProfile?.profession || 'Professional'}, based in ${
        currentProfile?.location || 'our community'
      }).\n\nI have reviewed the profile of your family member, ${
        targetProfile.full_name
      }, on the DaheejFree Matrimonial Platform.\n\nI have solemnly pledged to a 100% Dowry-Free Nikah in accordance with the Prophet’s Sunnah (no demands, no dowry expectations, and genuine Mahr honoring).\n\nI would be honored to introduce myself and my family directly to you to discuss a Halal matrimonial proposal.\n\nJazakAllahu Khairan,\n${
        currentProfile?.full_name || 'Brother'
      }\nContact: member@daheejfree.org`;
      setMessage(defaultMessage);
    }
  }, [targetProfile, currentProfile]);

  if (!targetProfile || !targetProfile.wali_email) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(targetProfile.wali_email!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Halal Matrimonial Inquiry via DaheejFree for ${targetProfile.full_name}`);
    const body = encodeURIComponent(message);
    window.open(`mailto:${targetProfile.wali_email}?subject=${subject}&body=${body}`, '_blank');
    setMessageSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-emerald-500/40 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-emerald-950 p-5 border-b border-emerald-600/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Direct Wali Contact</h3>
              <p className="text-xs text-emerald-400">Diamond Tier Authorized • {targetProfile.full_name}</p>
            </div>
          </div>
          <button
            id="btn-close-wali-modal"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Wali Email Bar */}
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Mail className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Official Guardian Email</span>
                <span className="text-sm font-mono text-emerald-300 font-semibold">{targetProfile.wali_email}</span>
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 transition-colors flex-shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Sunnah Etiquette Notice */}
          <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3.5 text-xs text-emerald-200/90 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
              <HeartHandshake className="w-4 h-4 text-emerald-400" />
              Islamic Wali Etiquette
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              All communications sent to the Wali should maintain the highest standards of Islamic modesty, family respect, and transparent background introduction.
            </p>
          </div>

          {/* Pre-drafted Proposal Message */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Draft Halal Introduction Message to Wali:
            </label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-zinc-950 text-xs text-zinc-200 rounded-xl p-3 border border-zinc-800 focus:outline-none focus:border-emerald-500 font-sans leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              id="btn-send-wali-email"
              onClick={handleSendEmail}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {messageSent ? 'Email Client Opened' : 'Launch Email Client to Wali'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
