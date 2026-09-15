'use client';

// ==============================================================================
// ADMIN KYC DASHBOARD: BOT ELIMINATION & IDENTITY APPROVAL CONSOLE
// ==============================================================================

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  XCircle,
  FileText,
  UserCheck,
  Search,
  Lock,
  ExternalLink,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { Profile } from '../../../types/database';
import { useAuth } from '../../../hooks/useAuth';
import { daheejStore } from '../../../lib/supabase/store';
import { Logo } from '../../../components/brand/Logo';

export default function AdminKYCReviewPage() {
  const { profile: currentProfile, allProfiles, refreshState, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isAdmin = Boolean(
    currentProfile &&
      (currentProfile.id === 'admin' ||
        (currentProfile as any).is_admin === true ||
        (currentProfile as any).role === 'admin' ||
        currentProfile.wali_email === 'admin@daheejfree.com' ||
        currentProfile.wali_email === 'behumble7860@gmail.com' ||
        currentProfile.wali_email === 'hasnainkhan3177@gmail.com')
  );

  // ALL HOOKS UNCONDITIONALLY AT THE TOP BEFORE ANY RETURN (fixes React Error #310)
  const pendingProfiles = useMemo(() => {
    return allProfiles.filter((p) => {
      const isReviewCandidate = p.kyc_status === 'pending' || p.kyc_status === 'unverified';
      if (!isReviewCandidate) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          p.full_name.toLowerCase().includes(q) ||
          p.profession?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allProfiles, searchTerm]);

  const verifiedCount = useMemo(
    () => allProfiles.filter((p) => p.kyc_status === 'verified').length,
    [allProfiles]
  );
  const bannedCount = useMemo(
    () => allProfiles.filter((p) => p.kyc_status === 'banned').length,
    [allProfiles]
  );

  // 1. Loading state: Never render Restricted UI while evaluating credentials
  if (isLoading) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-center space-y-4 shadow-xl animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6 animate-pulse text-emerald-500" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Verifying Admin Credentials...</h2>
        <p className="text-xs text-zinc-500">Checking compliance role and security clearance.</p>
      </div>
    );
  }

  // 2. Security gate: Block unauthorized visitors once loading finishes
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/60 rounded-3xl text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Admin Access Restricted</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          The Admin KYC Compliance Console requires verified administrator privileges.
        </p>
      </div>
    );
  }

  const handleApprove = (profileId: string) => {
    daheejStore.updateKYCStatus(profileId, 'verified');
    setActionSuccess(`Profile ${profileId} approved and verified.`);
    refreshState();
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleRejectAndBan = (profileId: string) => {
    daheejStore.updateKYCStatus(profileId, 'banned');
    setActionSuccess(`Profile ${profileId} rejected and permanently banned.`);
    refreshState();
    setTimeout(() => setActionSuccess(null), 3000);
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 py-10 px-4 sm:px-6 lg:px-8 space-y-8 max-w-7xl mx-auto transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 uppercase">
              Admin Compliance
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white mt-2">
            KYC Identity Review & Zero-Bot Approval Console
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Review identity records and Didit protocol verification audits to uphold 100% verified standards.
          </p>
        </div>

        {/* Stats Metrics */}
        <div className="flex items-center gap-3">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-center min-w-[100px] shadow-sm">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Pending</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{pendingProfiles.length}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-center min-w-[100px] shadow-sm">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Verified</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{verifiedCount}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 text-center min-w-[100px] shadow-sm">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Banned</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{bannedCount}</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-3 shadow-lg">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search applicants by name, location, profession..."
          className="w-full bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-200 pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
        />
      </div>

      {/* Pending Grid */}
      {pendingProfiles.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-3 shadow-sm">
          <UserCheck className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">KYC Review Queue Clean</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">All registered profiles have been processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingProfiles.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 flex flex-col justify-between space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-white text-sm">{p.full_name}</h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {p.gender === 'female' ? 'Sister (Bride)' : 'Brother (Groom)'} • {p.location || 'Unspecified'}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    PENDING KYC
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800/80 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <p><strong>Phone:</strong> {p.phone_number}</p>
                  <p><strong>Profession:</strong> {p.profession || 'N/A'}</p>
                  <p><strong>Wali Details:</strong> {p.wali_name || 'N/A'} ({p.wali_relation || 'Guardian'})</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate"><strong>Bio:</strong> {p.bio || 'No bio.'}</p>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{p.kyc_document_type || 'National ID Document'}</span>
                  </div>
                  <a
                    href={p.kyc_document_url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>View Document</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                <button
                  onClick={() => handleRejectAndBan(p.id)}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-red-100 dark:bg-red-950 hover:bg-red-200 dark:hover:bg-red-900 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  Reject & Ban
                </button>

                <button
                  onClick={() => handleApprove(p.id)}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/20 transition-all hover:scale-[1.02]"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve KYC
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
