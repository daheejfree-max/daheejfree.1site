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
  ArrowDownCircle,
  ShieldOff,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, daheejStore } from '../../lib/supabase/client';
import { Profile } from '../../types/database';
import { executeAdminAction } from './actions';
import AdminBot from '../../components/AdminBot';

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
        const currentLocal = daheejStore.getCurrentProfile();

        const userEmail = (user?.email || (currentLocal as any)?.email || '').toLowerCase();
        const isDesignated =
          userEmail === 'behumble7860@gmail.com' ||
          userEmail === 'hasnainkhan3177@gmail.com' ||
          userEmail === 'admin@daheejfree.com' ||
          (currentLocal as any)?.is_admin === true;

        if (user && isSupabaseConfigured) {
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .maybeSingle();

          if (profileErr) {
            console.warn('[AdminPage] Admin verification lookup notice:', profileErr.message);
          }

          setIsAdmin(Boolean(profile?.is_admin || isDesignated));
        } else {
          setIsAdmin(Boolean(isDesignated));
        }
      } catch (err) {
        const currentLocal = daheejStore.getCurrentProfile();
        setIsAdmin(Boolean((currentLocal as any)?.is_admin === true));
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

  // 1. Fetch all users from public.profiles or reactive store
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let loadedProfiles: Profile[] = [];

      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            const fallbackRes = await supabase.from('profiles').select('*');
            if (fallbackRes.data && fallbackRes.data.length > 0) {
              loadedProfiles = fallbackRes.data as Profile[];
            }
          } else if (data && data.length > 0) {
            loadedProfiles = data as Profile[];
          }
        } catch {
          // Handled below via reactive store
        }
      }

      if (loadedProfiles.length === 0) {
        const local = daheejStore.getAllProfiles();
        if (local && local.length > 0) {
          loadedProfiles = local as unknown as Profile[];
        }
      }

      setUsers(loadedProfiles);
    } catch (err: any) {
      console.warn('[Admin Dashboard] Loading fallback profiles:', err);
      const local = daheejStore.getAllProfiles();
      setUsers((local as unknown as Profile[]) || []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and Realtime sync
  useEffect(() => {
    fetchUsers();

    // Subscribe to realtime profile changes so God Mode dashboard updates live
    if (isSupabaseConfigured) {
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
    }
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

  // 4. Secure Action Dispatcher (Powered by Next.js Server Action)
  const executeAction = async (
    action: 'verify_kyc' | 'unverify_kyc' | 'grant_subscription' | 'set_free' | 'ban_user' | 'unban_user',
    targetUserId: string,
    payload?: any
  ) => {
    // Retrieve caller session token and user info
    const sessionRes = await supabase.auth.getSession();
    const session = sessionRes.data.session;
    const currentUser = session?.user;

    // Attempt Next.js Server Action execution first
    let result: any = null;
    try {
      result = await executeAdminAction(targetUserId, action, {
        ...payload,
        token: session?.access_token,
      });
    } catch (actionErr: any) {
      console.warn('[Admin Server Action Warning]:', actionErr);
    }

    if (!result || !result.success) {
      // Direct client fallback using current admin user's authenticated Supabase client
      let updateData: any = { updated_at: new Date().toISOString() };
      if (action === 'verify_kyc') {
        updateData = { ...updateData, kyc_verified: true, kyc_status: 'verified', id_verified: true, is_verified: true };
      } else if (action === 'unverify_kyc') {
        updateData = { ...updateData, kyc_verified: false, kyc_status: 'pending', id_verified: false, is_verified: false };
      } else if (action === 'grant_subscription') {
        updateData = { ...updateData, subscription_tier: payload?.subscription_tier || payload?.tier || 'gold', membership_tier: payload?.subscription_tier || payload?.tier || 'gold' };
      } else if (action === 'set_free') {
        updateData = { ...updateData, subscription_tier: 'free', membership_tier: 'free', subscription_status: 'inactive' };
      } else if (action === 'ban_user') {
        updateData = { ...updateData, is_active: false };
      } else if (action === 'unban_user') {
        updateData = { ...updateData, is_active: true };
      }

      if (isSupabaseConfigured) {
        try {
          const { data: updatedProfile, error: fallbackError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', targetUserId)
            .select()
            .maybeSingle();

          if (!fallbackError && updatedProfile) {
            return {
              success: true,
              message: `Action '${action}' executed successfully.`,
              profile: updatedProfile,
            };
          }
        } catch (dbErr) {
          console.warn('[Admin Client DB Fallback Warning]:', dbErr);
        }
      }

      // Reactive local store fallback
      const localUpdated = daheejStore.updateProfile(targetUserId, updateData);
      // Also update local users state directly in case candidate was dynamically loaded
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, ...updateData } : u))
      );

      return {
        success: true,
        message: `Action '${action}' executed successfully.`,
        profile: (localUpdated as unknown as Profile) || ({ id: targetUserId, ...updateData } as Profile),
      };
    }

    return result;
  };

  const handleAction = async (
    action: 'verify_kyc' | 'unverify_kyc' | 'grant_subscription' | 'set_free' | 'ban_user' | 'unban_user',
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

  const handleAdminAction = handleAction;

  // 1. Loading state: Never render Restricted UI while evaluating credentials
  if (authLoading) {
    return (
      <div className="min-h-[450px] flex flex-col items-center justify-center space-y-4 p-8 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-lg animate-pulse">
          <ShieldAlert className="w-7 h-7 animate-pulse text-emerald-500" />
        </div>
        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Verifying Admin Access...</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Checking security clearance and is_admin credentials with Supabase.</p>
      </div>
    );
  }

  // 2. Restricted UI: Only render when verification completed and isAdmin is false
  if (!isAdmin) {
    return (
      <div className="min-h-[600px] flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="max-w-md w-full mx-auto p-8 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-3xl text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Admin Access Restricted</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            The God Mode Control Panel requires verified administrator privileges.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen transition-colors">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
              : notification.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-500/40 text-red-900 dark:text-red-200'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-zinc-500 shrink-0" />
            )}
            <span className="text-xs md:text-sm font-semibold">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Autonomous Developer Agent Chat Terminal */}
      <AdminBot />

      {/* 1. Stats Overview Cards (Compact 3-Column Grid on Mobile & Desktop) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Total Users */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 sm:p-6 relative overflow-hidden shadow-xs sm:shadow-sm dark:shadow-md transition-all hover:border-zinc-300 dark:hover:border-zinc-700 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">Total Users</span>
            <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4 flex items-baseline gap-1 sm:gap-2">
            <span className="text-xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tight">{stats.totalUsers}</span>
            <span className="text-[10px] sm:text-xs text-zinc-500 font-medium hidden sm:inline">accounts</span>
          </div>
          <div className="hidden sm:flex mt-3 sm:mt-4 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Active database records</span>
          </div>
        </div>

        {/* Pending KYC */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 sm:p-6 relative overflow-hidden shadow-xs sm:shadow-sm dark:shadow-md transition-all hover:border-zinc-300 dark:hover:border-zinc-700 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">Pending KYC</span>
            <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4 flex items-baseline gap-1 sm:gap-2">
            <span className="text-xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{stats.pendingKYCs}</span>
            <span className="text-[10px] sm:text-xs text-zinc-500 font-medium hidden sm:inline">reviews</span>
          </div>
          <div className="hidden sm:flex mt-3 sm:mt-4 items-center gap-2 text-xs text-amber-700 dark:text-amber-400/90">
            <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
            <span>Requires identity vetting</span>
          </div>
        </div>

        {/* Premium */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 sm:p-6 relative overflow-hidden shadow-xs sm:shadow-sm dark:shadow-md transition-all hover:border-zinc-300 dark:hover:border-zinc-700 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 truncate">Premium</span>
            <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Crown className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4 flex items-baseline gap-1 sm:gap-2">
            <span className="text-xl sm:text-4xl font-black text-purple-600 dark:text-purple-400 tracking-tight">{stats.premiumUsers}</span>
            <span className="text-[10px] sm:text-xs text-zinc-500 font-medium hidden sm:inline">VIP</span>
          </div>
          <div className="hidden sm:flex mt-3 sm:mt-4 items-center gap-2 text-xs text-purple-700 dark:text-purple-300/90">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Paid tier entitlements</span>
          </div>
        </div>
      </div>

      {/* 2. Control Toolbar (Search, Filter Tabs & Refresh) */}
      <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 sm:space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, ID, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-base sm:text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Quick Refresh Button */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer min-h-[40px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-500 dark:text-emerald-400' : ''}`} />
              <span>Refresh Directory</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs (Horizontal touch scrolling with edge padding) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs border-t border-zinc-200 dark:border-zinc-800 pt-3 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] flex items-center ${
              activeTab === 'all'
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending_kyc')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] flex items-center ${
              activeTab === 'pending_kyc'
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Pending KYC ({stats.pendingKYCs})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verified_kyc')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] flex items-center ${
              activeTab === 'verified_kyc'
                ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Verified KYC ({users.filter((u) => u.kyc_verified).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('premium')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] flex items-center ${
              activeTab === 'premium'
                ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Premium Tier ({stats.premiumUsers})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('banned')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] flex items-center ${
              activeTab === 'banned'
                ? 'bg-red-500/20 text-red-800 dark:text-red-300 border border-red-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Suspended ({stats.bannedUsers})
          </button>
        </div>
      </div>

      {/* 3. Comprehensive Users Data Table & Mobile Cards */}
      <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xl">
        {/* Desktop View: Full Table */}
        <div className="hidden md:block w-full overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300 border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">User / Candidate</th>
                <th className="py-3.5 px-4">KYC Compliance</th>
                <th className="py-3.5 px-4">Subscription</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4 text-right">God Mode Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500 dark:text-emerald-400" />
                    <span>Loading user directory from Supabase...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <Users className="w-6 h-6 mx-auto mb-2 text-zinc-400 dark:text-zinc-600" />
                    <span>No users found matching your search and filter criteria.</span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isVerified = Boolean(user.kyc_verified || user.kyc_status === 'verified');
                  const isPending = user.kyc_status === 'pending' || user.kyc_status === 'unverified';
                  const isBanned = user.is_active === false || user.kyc_status === 'banned';
                  const currentTier = user.subscription_tier?.toLowerCase() || 'free';

                  return (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      {/* Name / ID Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-xl object-cover bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
                              {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-zinc-900 dark:text-white text-xs truncate max-w-[150px] sm:max-w-[200px]">
                                {user.full_name || 'Unnamed Candidate'}
                              </span>
                              {user.is_admin && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
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
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Verified
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            Pending Review
                          </span>
                        ) : isBanned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                            <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                            Rejected / Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                            Unverified
                          </span>
                        )}
                      </td>

                      {/* Subscription Column */}
                      <td className="py-3.5 px-4">
                        {currentTier === 'diamond' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                            <Crown className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                            Diamond
                          </span>
                        ) : currentTier === 'gold' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                            <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            Gold Tier
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                            Free Tier
                          </span>
                        )}
                      </td>

                      {/* Account Status Column */}
                      <td className="py-3.5 px-4">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* Action Controls Column */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* Approve KYC Button */}
                          {!isVerified && (
                            <button
                              type="button"
                              disabled={Boolean(actionLoadingId)}
                              onClick={() => handleAction('verify_kyc', user.id)}
                              className="px-3 py-1 text-xs font-semibold rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                              title="Approve Government ID and Selfie Verification"
                            >
                              {actionLoadingId === `verify_kyc-${user.id}` ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>Approve KYC</span>
                            </button>
                          )}

                          {/* Unverify Button */}
                          <button
                            type="button"
                            disabled={Boolean(actionLoadingId) || (!isVerified && user.kyc_status === 'pending' && !user.kyc_verified)}
                            onClick={() => handleAction('unverify_kyc', user.id)}
                            className="px-3 py-1 text-xs font-semibold rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                            title="Downgrade user: Set KYC status to pending and revoke verification"
                          >
                            {actionLoadingId === `unverify_kyc-${user.id}` ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            )}
                            <span>Unverify</span>
                          </button>

                          {/* Grant Subscription Button */}
                          <button
                            type="button"
                            disabled={Boolean(actionLoadingId)}
                            onClick={() =>
                              handleAction(
                                'grant_subscription',
                                user.id,
                                { tier: currentTier === 'gold' ? 'diamond' : 'gold' }
                              )
                            }
                            className="px-3 py-1 text-xs font-semibold rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                            title={currentTier === 'gold' ? 'Promote to Diamond Tier' : 'Grant Gold Subscription Tier'}
                          >
                            {actionLoadingId === `grant_subscription-${user.id}` ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Crown className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            )}
                            <span>{currentTier === 'gold' ? '+ Diamond' : '+ Gold'}</span>
                          </button>

                          {/* Set Free Button */}
                          <button
                            type="button"
                            disabled={Boolean(actionLoadingId) || currentTier === 'free'}
                            onClick={() => handleAction('set_free', user.id, { tier: 'free' })}
                            className="px-3 py-1 text-xs font-semibold rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                            title={currentTier === 'free' ? 'User is already on Free tier' : 'Downgrade subscription tier to Free'}
                          >
                            {actionLoadingId === `set_free-${user.id}` ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ArrowDownCircle className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            )}
                            <span>Set Free</span>
                          </button>

                          {/* Ban / Unban Button */}
                          {isBanned ? (
                            <button
                              type="button"
                              disabled={Boolean(actionLoadingId)}
                              onClick={() => handleAction('unban_user', user.id)}
                              className="px-3 py-1 text-xs font-semibold rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                              title="Unban and Reactivate User Account"
                            >
                              {actionLoadingId === `unban_user-${user.id}` ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>Unban</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(actionLoadingId) || user.is_admin}
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to suspend user ${user.full_name || user.id}?`)) {
                                  handleAction('ban_user', user.id);
                                }
                              }}
                              className="px-3 py-1 text-xs font-semibold rounded-md bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                              title={user.is_admin ? 'Cannot ban an admin' : 'Suspend and Ban User Account'}
                            >
                              {actionLoadingId === `ban_user-${user.id}` ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserX className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
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

        {/* Mobile View: Touch-First Candidate Cards (No Horizontal Scrolling Required) */}
        <div className="block md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
          {loading && users.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 p-4">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500 dark:text-emerald-400" />
              <span className="text-xs">Loading directory...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 p-4">
              <Users className="w-6 h-6 mx-auto mb-2 text-zinc-400 dark:text-zinc-600" />
              <span className="text-xs">No users match your criteria.</span>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isVerified = Boolean(user.kyc_verified || user.kyc_status === 'verified');
              const isPending = user.kyc_status === 'pending' || user.kyc_status === 'unverified';
              const isBanned = user.is_active === false || user.kyc_status === 'banned';
              const currentTier = user.subscription_tier?.toLowerCase() || 'free';

              return (
                <div key={`mobile-card-${user.id}`} className="p-3.5 space-y-3 bg-white dark:bg-zinc-900">
                  {/* Candidate Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-xl object-cover bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
                          {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-zinc-900 dark:text-white text-xs truncate max-w-[140px]">
                            {user.full_name || 'Unnamed Candidate'}
                          </p>
                          {user.is_admin && (
                            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                          ID: {user.id.substring(0, 8)}... {user.gender ? `• ${user.gender}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Account Status Pill */}
                    <div className="shrink-0">
                      {isBanned ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges Row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* KYC Badge */}
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Verified KYC
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Pending Review
                      </span>
                    ) : isBanned ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                        <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                        Banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        Unverified
                      </span>
                    )}

                    {/* Tier Badge */}
                    {currentTier === 'diamond' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                        <Crown className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                        Diamond
                      </span>
                    ) : currentTier === 'gold' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                        <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Gold
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        Free Plan
                      </span>
                    )}
                  </div>

                  {/* Mobile Action Buttons Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {!isVerified ? (
                      <button
                        type="button"
                        disabled={Boolean(actionLoadingId)}
                        onClick={() => handleAction('verify_kyc', user.id)}
                        className="min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        {actionLoadingId === `verify_kyc-${user.id}` ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span>Approve KYC</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(actionLoadingId)}
                        onClick={() => handleAction('unverify_kyc', user.id)}
                        className="min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        {actionLoadingId === `unverify_kyc-${user.id}` ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                        <span>Unverify</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={Boolean(actionLoadingId)}
                      onClick={() =>
                        handleAction(
                          'grant_subscription',
                          user.id,
                          { tier: currentTier === 'gold' ? 'diamond' : 'gold' }
                        )
                      }
                      className="min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      {actionLoadingId === `grant_subscription-${user.id}` ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Crown className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      )}
                      <span>{currentTier === 'gold' ? '+ Diamond' : '+ Gold'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(actionLoadingId) || currentTier === 'free'}
                      onClick={() => handleAction('set_free', user.id, { tier: 'free' })}
                      className="min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      {actionLoadingId === `set_free-${user.id}` ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowDownCircle className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                      <span>Set Free</span>
                    </button>

                    {isBanned ? (
                      <button
                        type="button"
                        disabled={Boolean(actionLoadingId)}
                        onClick={() => handleAction('unban_user', user.id)}
                        className="min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        {actionLoadingId === `unban_user-${user.id}` ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>Unban</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(actionLoadingId) || user.is_admin}
                        onClick={() => {
                          if (window.confirm(`Suspend user ${user.full_name || user.id}?`)) {
                            handleAction('ban_user', user.id);
                          }
                        }}
                        className="min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        {actionLoadingId === `ban_user-${user.id}` ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserX className="w-3.5 h-3.5 text-red-600" />
                        )}
                        <span>Ban User</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
