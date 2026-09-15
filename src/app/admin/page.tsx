'use client';

// ==============================================================================
// GOD MODE ADMIN CONTROL PANEL (Client Component)
// Full capabilities over user accounts, KYC vetting & subscription management
// ==============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  UserX,
  Sparkles,
  ExternalLink,
  Clock,
  Filter,
  ArrowUpDown,
  Lock,
  Eye,
  ChevronDown,
  Info,
  Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { Profile } from '../../types/database';

type FilterTab = 'all' | 'pending_kyc' | 'verified_kyc' | 'premium' | 'banned';

export default function AdminControlPanel() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Client Component Admin Guard with Loading State
  useEffect(() => {
    async function checkAdminClearance() {
      try {
        setAuthLoading(true);
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user) {
          setIsAdmin(false);
          return;
        }

        const userEmail = user.email?.toLowerCase() || '';
        const isDesignated =
          userEmail === 'behumble7860@gmail.com' ||
          userEmail === 'hasnainkhan3177@gmail.com' ||
          userEmail === 'admin@daheejfree.com';

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        setIsAdmin(Boolean(profile?.is_admin || isDesignated));
      } catch (err) {
        console.error('[Admin Auth Guard Error]:', err);
        setIsAdmin(false);
      } finally {
        setAuthLoading(false);
      }
    }

    checkAdminClearance();
  }, []);

  // Auto-dismiss notifications after 4.5s
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4500);
    return () => clearTimeout(timer);
  }, [notification]);

  // 1. Fetch all users from public.profiles
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback without order in case created_at column is missing on older schemas
        const fallbackRes = await supabase.from('profiles').select('*');
        if (fallbackRes.error) {
          throw fallbackRes.error;
        }
        setUsers(fallbackRes.data || []);
      } else {
        setUsers(data || []);
      }
    } catch (err: any) {
      console.error('[Admin Dashboard] Failed to load profiles:', err);
      setNotification({
        type: 'error',
        message: `Failed to load user directory: ${err?.message || 'Database error'}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and Realtime sync
  useEffect(() => {
    fetchUsers();

    // Subscribe to realtime profile changes so God Mode dashboard updates live
    const channel = supabase
      .channel('admin_profiles_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setUsers((prev) =>
              prev.map((u) => (u.id === payload.new.id ? { ...u, ...payload.new } : u))
            );
          } else if (payload.eventType === 'INSERT') {
            setUsers((prev) => [payload.new as Profile, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setUsers((prev) => prev.filter((u) => u.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]);

  // 2. Metric Calculations
  const stats = useMemo(() => {
    const totalUsers = users.length;

    const pendingKYCs = users.filter((u) => {
      const status = u.kyc_status?.toLowerCase();
      return status === 'pending' || status === 'unverified' || (!u.kyc_verified && status !== 'banned');
    }).length;

    const premiumUsers = users.filter((u) => {
      const tier = u.subscription_tier?.toLowerCase();
      return tier === 'gold' || tier === 'diamond' || tier === 'platinum';
    }).length;

    const bannedUsers = users.filter((u) => u.is_active === false || u.kyc_status === 'banned').length;

    return { totalUsers, pendingKYCs, premiumUsers, bannedUsers };
  }, [users]);

  // 3. Filtered User List
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Tab matching
      if (activeTab === 'pending_kyc') {
        const isPending =
          user.kyc_status === 'pending' ||
          user.kyc_status === 'unverified' ||
          (!user.kyc_verified && user.kyc_status !== 'banned');
        if (!isPending) return false;
      } else if (activeTab === 'verified_kyc') {
        if (!user.kyc_verified && user.kyc_status !== 'verified') return false;
      } else if (activeTab === 'premium') {
        const t = user.subscription_tier?.toLowerCase();
        if (t !== 'gold' && t !== 'diamond' && t !== 'platinum') return false;
      } else if (activeTab === 'banned') {
        if (user.is_active !== false && user.kyc_status !== 'banned') return false;
      }

      // Search matching
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = user.full_name?.toLowerCase().includes(q);
        const matchId = user.id?.toLowerCase().includes(q);
        const matchPhone = user.phone_number?.toLowerCase().includes(q);
        const matchEmail = user.wali_email?.toLowerCase().includes(q);
        return matchName || matchId || matchPhone || matchEmail;
      }

      return true;
    });
  }, [users, activeTab, searchTerm]);

  // 4. Secure Action Dispatcher
  const executeAction = async (
    action: 'verify_kyc' | 'grant_subscription' | 'ban_user' | 'unban_user',
    targetUserId: string,
    payload?: any
  ) => {
    // Retrieve caller session token
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;

    if (!token) {
      throw new Error('No active authentication session. Please re-login.');
    }

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action,
        targetUserId,
        payload,
      }),
    });

    const rawText = await res.text();
    let result: any;
    try {
      result = JSON.parse(rawText);
    } catch (e) {
      console.error("Backend crashed with non-JSON response:", rawText);
      throw new Error(`Server error (Status ${res.status}). Check Vercel logs.`);
    }
    if (!res.ok) throw new Error(result.error || 'Request rejected');

    return result;
  };

  const handleAdminAction = async (
    action: 'verify_kyc' | 'grant_subscription' | 'ban_user' | 'unban_user',
    targetUserId: string,
    payload?: any
  ) => {
    setActionLoadingId(`${action}-${targetUserId}`);
    setNotification(null);

    try {
      const result = await executeAction(action, targetUserId, payload);

      // Show success feedback
      setNotification({
        type: 'success',
        message: result.message || `Action '${action}' executed successfully.`,
      });

      // Optimistically update local state immediately
      if (result.profile) {
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, ...result.profile } : u))
        );
      } else {
        await fetchUsers();
      }
    } catch (err: any) {
      console.error(`[Admin Action ${action} Failure]:`, err);
      setNotification({
        type: 'error',
        message: err?.message || `Failed to execute action ${action}.`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 1. Loading state: Never render Restricted UI while evaluating credentials
  if (authLoading) {
    return (
      <div className="min-h-[450px] flex flex-col items-center justify-center space-y-4 p-8">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg animate-pulse">
          <ShieldAlert className="w-7 h-7 animate-pulse text-emerald-500" />
        </div>
        <h2 className="text-lg font-bold text-zinc-200">Verifying Admin Access...</h2>
        <p className="text-xs text-zinc-500">Checking security clearance and is_admin credentials with Supabase.</p>
      </div>
    );
  }

  // 2. Restricted UI: Only render when verification completed and isAdmin is false
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-zinc-900 border border-red-900/50 rounded-3xl text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-red-950 text-red-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Admin Access Restricted</h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          The God Mode Control Panel requires verified administrator privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : notification.type === 'error'
              ? 'bg-red-950/80 border-red-500/40 text-red-200'
              : 'bg-zinc-800 border-zinc-700 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-zinc-400 shrink-0" />
            )}
            <span className="text-xs md:text-sm font-semibold">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 rounded-md hover:bg-white/10 text-xs text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Users</span>
            <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tracking-tight">{stats.totalUsers}</span>
            <span className="text-xs text-zinc-500 font-medium">registered</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Active database records</span>
          </div>
        </div>

        {/* Pending KYCs */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pending KYCs</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400 tracking-tight">{stats.pendingKYCs}</span>
            <span className="text-xs text-zinc-500 font-medium">awaiting review</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400/80">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Requires identity vetting</span>
          </div>
        </div>

        {/* Premium Users */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Premium Members</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-400 tracking-tight">{stats.premiumUsers}</span>
            <span className="text-xs text-zinc-500 font-medium">Gold / Diamond</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-purple-300/80">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Paid tier entitlements</span>
          </div>
        </div>

        {/* Suspended / Banned */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Suspended / Banned</span>
            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-red-400 tracking-tight">{stats.bannedUsers}</span>
            <span className="text-xs text-zinc-500 font-medium">restricted</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-red-400/80">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Blocked from platform</span>
          </div>
        </div>
      </div>

      {/* 2. Control Toolbar (Search, Filter Tabs & Refresh) */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, ID, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Quick Refresh Button */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh Directory</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs border-t border-zinc-800/60 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending_kyc')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'pending_kyc'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/40'
            }`}
          >
            Pending KYC ({stats.pendingKYCs})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verified_kyc')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'verified_kyc'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/40'
            }`}
          >
            Verified KYC ({users.filter((u) => u.kyc_verified).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('premium')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'premium'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-zinc-400 hover:text-purple-400 hover:bg-zinc-800/40'
            }`}
          >
            Premium Tier ({stats.premiumUsers})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('banned')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'banned'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'text-zinc-400 hover:text-red-400 hover:bg-zinc-800/40'
            }`}
          >
            Suspended ({stats.bannedUsers})
          </button>
        </div>
      </div>

      {/* 3. Comprehensive Users Data Table */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300 border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">User / Candidate</th>
                <th className="py-3.5 px-4">KYC Compliance</th>
                <th className="py-3.5 px-4">Subscription</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4 text-right">God Mode Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    <span>Loading user directory from Supabase...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <Users className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
                    <span>No users found matching your search and filter criteria.</span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isVerified = Boolean(user.kyc_verified || user.kyc_status === 'verified');
                  const isPending = user.kyc_status === 'pending' || user.kyc_status === 'unverified';
                  const isBanned = user.is_active === false || user.kyc_status === 'banned';
                  const currentTier = user.subscription_tier?.toLowerCase() || 'free';
                  const isGoldOrDiamond = currentTier === 'gold' || currentTier === 'diamond' || currentTier === 'platinum';

                  return (
                    <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors">
                      {/* Name / ID Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-xl object-cover bg-zinc-800 border border-zinc-700 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300 shrink-0">
                              {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs truncate max-w-[150px] sm:max-w-[200px]">
                                {user.full_name || 'Unnamed Candidate'}
                              </span>
                              {user.is_admin && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                              <span className="font-mono">{user.id.substring(0, 8)}...</span>
                              {user.gender && <span className="capitalize">• {user.gender}</span>}
                              {user.wali_email && <span className="truncate max-w-[120px]">• {user.wali_email}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* KYC Status Column */}
                      <td className="py-3.5 px-4">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            Verified
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            Pending Review
                          </span>
                        ) : isBanned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            Rejected / Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Unverified
                          </span>
                        )}
                      </td>

                      {/* Subscription Column */}
                      <td className="py-3.5 px-4">
                        {currentTier === 'diamond' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            <Crown className="w-3.5 h-3.5 text-cyan-400" />
                            Diamond
                          </span>
                        ) : currentTier === 'gold' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            Gold Tier
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                            Free Tier
                          </span>
                        )}
                      </td>

                      {/* Account Status Column */}
                      <td className="py-3.5 px-4">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-red-950/60 text-red-400 border border-red-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* Action Controls Column */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Approve KYC Button */}
                          {!isVerified && (
                            <button
                              type="button"
                              disabled={Boolean(actionLoadingId)}
                              onClick={() => handleAdminAction('verify_kyc', user.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                              title="Approve Government ID and Selfie Verification"
                            >
                              {actionLoadingId === `verify_kyc-${user.id}` ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              )}
                              <span>Approve KYC</span>
                            </button>
                          )}

                          {/* Grant Subscription Button (Gold or Diamond) */}
                          <button
                            type="button"
                            disabled={Boolean(actionLoadingId)}
                            onClick={() =>
                              handleAdminAction(
                                'grant_subscription',
                                user.id,
                                { tier: currentTier === 'gold' ? 'diamond' : 'gold' }
                              )
                            }
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-500/30 flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                            title={currentTier === 'gold' ? 'Promote to Diamond Tier' : 'Grant Gold Subscription Tier'}
                          >
                            {actionLoadingId === `grant_subscription-${user.id}` ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Crown className="w-3 h-3 text-purple-400" />
                            )}
                            <span>{currentTier === 'gold' ? '+ Diamond' : '+ Gold'}</span>
                          </button>

                          {/* Ban / Unban Button */}
                          {isBanned ? (
                            <button
                              type="button"
                              disabled={Boolean(actionLoadingId)}
                              onClick={() => handleAdminAction('unban_user', user.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                              title="Unban and Reactivate User Account"
                            >
                              {actionLoadingId === `unban_user-${user.id}` ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserCheck className="w-3 h-3 text-emerald-400" />
                              )}
                              <span>Unban</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(actionLoadingId) || user.is_admin}
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to suspend user ${user.full_name || user.id}?`)) {
                                  handleAdminAction('ban_user', user.id);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/30 flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                              title={user.is_admin ? 'Cannot ban an admin' : 'Suspend and Ban User Account'}
                            >
                              {actionLoadingId === `ban_user-${user.id}` ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserX className="w-3 h-3 text-red-400" />
                              )}
                              <span>Ban</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
