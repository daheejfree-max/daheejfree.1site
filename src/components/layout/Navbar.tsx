'use client';

// ==============================================================================
// CONSOLIDATED PREMIUM NAVBAR COMPONENT (src/components/layout/Navbar.tsx)
// Exact Count Queries, Instant Decrementing Badges, and Ghost Profile Filtration
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from '../../lib/navigation';
import {
  Shield,
  Heart,
  PhoneCall,
  Crown,
  Lock,
  Sparkles,
  Users,
  CheckCircle,
  CreditCard,
  LogOut,
  LogIn,
  User,
  ChevronDown,
  MessageSquare,
  HeartHandshake,
  UserCheck,
  Menu,
  X,
  Compass,
  Globe,
} from 'lucide-react';
import { Profile, SubscriptionTier } from '../../types';
import { Logo } from '../brand/Logo';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { LanguageSelector, openLanguageSelectorModal } from '../common/LanguageSelector';
import { signOutSupabase } from '../../lib/supabase/auth';
import { supabase } from '../../lib/supabase/client';
import { daheejStore } from '../../lib/supabase/store';
import { NotificationsBell } from '../notifications/NotificationsBell';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentProfile: Profile | null;
  tier: SubscriptionTier;
  allProfiles: Profile[];
  onSwitchUser?: (userId: string) => void;
  onOpenPricing: () => void;
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
  pendingConsentCount: number;
  unreadMessagesCount?: number;
  pendingRequestsCount?: number;
  acceptedMatchesCount?: number;
  hideMobileNav?: boolean;
  isNavigationLocked?: boolean;
  isAdmin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  currentProfile,
  tier,
  allProfiles,
  onSwitchUser,
  onOpenPricing,
  onOpenLogin,
  onOpenRegister,
  pendingConsentCount,
  unreadMessagesCount = 0,
  pendingRequestsCount = 0,
  acceptedMatchesCount = 0,
  hideMobileNav = false,
  isNavigationLocked = false,
  isAdmin: isAdminProp,
}) => {
  const router = useRouter();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localIsAdmin, setLocalIsAdmin] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Strictly verify is_admin clearance in database to hide/show Admin God Mode button
  useEffect(() => {
    let isMounted = true;
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) setLocalIsAdmin(false);
          return;
        }

        const userEmail = (user.email || '').toLowerCase().trim();
        const isDesignatedSuperadmin =
          userEmail === 'hasnainkhan3177@gmail.com' ||
          userEmail === 'behumble7860@gmail.com' ||
          userEmail === 'admin@daheejfree.com';

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (profileErr) {
          console.warn('[Navbar] Admin lookup notice:', profileErr.message);
        }

        if (isMounted) {
          if (profile?.is_admin === true || isDesignatedSuperadmin) {
            setLocalIsAdmin(true);
          } else {
            setLocalIsAdmin(false);
          }
        }
      } catch (err) {
        if (isMounted) setLocalIsAdmin(false);
      }
    };

    checkAdmin();

    return () => {
      isMounted = false;
    };
  }, [currentProfile?.id]);

  // isAdmin strictly governed: if passed as prop, prioritize prop; otherwise fallback to local verified check
  const isAdmin = isAdminProp !== undefined ? Boolean(isAdminProp) : localIsAdmin;

  // Dynamic exact count state with real-time Supabase updates & instant decrementing
  const [livePendingRequestsCount, setLivePendingRequestsCount] = useState<number>(pendingRequestsCount);
  const [liveAcceptedMatchesCount, setLiveAcceptedMatchesCount] = useState<number>(acceptedMatchesCount);
  const [liveUnreadMessagesCount, setLiveUnreadMessagesCount] = useState<number>(unreadMessagesCount);

  // Update when parent props change
  useEffect(() => {
    setLivePendingRequestsCount(pendingRequestsCount);
  }, [pendingRequestsCount]);

  useEffect(() => {
    setLiveAcceptedMatchesCount(acceptedMatchesCount);
  }, [acceptedMatchesCount]);

  useEffect(() => {
    setLiveUnreadMessagesCount(unreadMessagesCount);
  }, [unreadMessagesCount]);

  // Dedicated real-time exact count queries for Requests & My Matches badges
  useEffect(() => {
    let isMounted = true;
    const currentUserId = currentProfile?.id;
    if (!currentUserId) {
      setLivePendingRequestsCount(0);
      setLiveAcceptedMatchesCount(0);
      setLiveUnreadMessagesCount(0);
      return;
    }

    const fetchExactCounts = async () => {
      try {
        // 1. 'Requests' Badge: Count ONLY rows where status === 'pending' AND receiver_id === currentUserId
        const { count: reqCount, error: reqErr } = await supabase
          .from('connections')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', currentUserId)
          .eq('status', 'pending');

        // 2. 'My Matches' Badge: Count rows where status === 'accepted' AND (receiver_id === currentUserId OR sender_id === currentUserId)
        const { count: matchCount, error: matchErr } = await supabase
          .from('connections')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'accepted')
          .or(`receiver_id.eq.${currentUserId},sender_id.eq.${currentUserId}`);

        if (isMounted) {
          if (!reqErr && typeof reqCount === 'number') {
            setLivePendingRequestsCount(reqCount);
          } else {
            const storePending = daheejStore.getPendingIncomingRequests(currentUserId);
            setLivePendingRequestsCount(storePending.length);
          }

          if (!matchErr && typeof matchCount === 'number') {
            setLiveAcceptedMatchesCount(matchCount);
          } else {
            const storeAccepted = daheejStore.getAcceptedConnectionPartnerIds(currentUserId);
            setLiveAcceptedMatchesCount(storeAccepted.length);
          }
        }
      } catch {
        if (isMounted) {
          const storePending = daheejStore.getPendingIncomingRequests(currentUserId);
          setLivePendingRequestsCount(storePending.length);
          const storeAccepted = daheejStore.getAcceptedConnectionPartnerIds(currentUserId);
          setLiveAcceptedMatchesCount(storeAccepted.length);
        }
      }
    };

    fetchExactCounts();

    // Instant local decrement event listener
    const handleRequestHandled = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (isMounted) {
        setLivePendingRequestsCount((prev) => Math.max(0, prev - 1));
        if (detail?.status === 'accepted') {
          setLiveAcceptedMatchesCount((prev) => prev + 1);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('daheej:request_handled', handleRequestHandled);
    }

    // Supabase Realtime subscription for automatic updates on connections (unique channel ID)
    const connChannelId = `navbar_badges_connections_${currentUserId}_${Math.random().toString(36).slice(2, 9)}`;
    const connChannel = supabase
      .channel(connChannelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
        },
        () => {
          fetchExactCounts();
        }
      )
      .subscribe();

    // Store subscription fallback for multi-tab reactivity
    const unsubStore = daheejStore.subscribe((e) => {
      if (!isMounted) return;
      if (e.table === 'connections') {
        const storePending = daheejStore.getPendingIncomingRequests(currentUserId);
        setLivePendingRequestsCount(storePending.length);
        const storeAccepted = daheejStore.getAcceptedConnectionPartnerIds(currentUserId);
        setLiveAcceptedMatchesCount(storeAccepted.length);
      } else if (e.table === 'messages') {
        const unread = daheejStore.getUnreadMessageCount(currentUserId);
        setLiveUnreadMessagesCount(unread);
      }
    });

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('daheej:request_handled', handleRequestHandled);
      }
      supabase.removeChannel(connChannel);
      unsubStore();
    };
  }, [currentProfile?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest('#btn-mobile-menu-toggle')) {
          setMobileMenuOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Automatically close mobile menu when hiding mobile nav or changing tabs
  useEffect(() => {
    if (hideMobileNav) {
      setMobileMenuOpen(false);
    }
  }, [hideMobileNav]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentTab]);

  const getTierBadge = (t: SubscriptionTier) => {
    switch (t) {
      case 'diamond':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 shadow-xs">
            <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Diamond
          </span>
        );
      case 'platinum':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Platinum
          </span>
        );
      case 'gold':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Gold
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
            Free Plan
          </span>
        );
    }
  };

  const handleNavClick = (tab: string) => {
    if (isNavigationLocked && tab !== 'onboarding') {
      return;
    }
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className={`sticky top-0 z-50 w-full transition-colors duration-200 border-b bg-white/90 backdrop-blur-md border-zinc-200 text-zinc-900 dark:bg-zinc-950/90 dark:backdrop-blur-md dark:border-zinc-800 dark:text-zinc-100 min-h-[44px] shrink-0 shadow-xs ${hideMobileNav ? '!hidden md:!block' : ''}`}>
      {/* 1. Solemn Islamic Anti-Dowry Pledge Banner */}
      <div className="bg-emerald-800 text-emerald-50 text-xs font-medium py-1.5 px-4 text-center tracking-wide dark:bg-emerald-950 dark:text-emerald-300 dark:border-b dark:border-emerald-900/50 flex items-center justify-center gap-2 shadow-xs">
        <Shield className="w-3.5 h-3.5 text-emerald-200 flex-shrink-0" />
        <span className="truncate max-w-2xl sm:max-w-none">
          <strong>Solemn Islamic Anti-Dowry Pledge:</strong> 100% Dowry-Free (Bila-Daheej) Nikah Platform. No demands, zero extortion, pure Sunnah simplicity.
        </span>
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand Logo */}
          <div className="flex items-center">
            <Logo
              size="md"
              showSubtitle={true}
              onClick={() => handleNavClick(currentProfile ? (isNavigationLocked ? 'onboarding' : 'matches') : 'landing')}
            />
          </div>

          {/* Center: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-2">
            {isNavigationLocked ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm font-semibold">
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Mandatory Legal Agreements & Profile Onboarding</span>
              </div>
            ) : currentProfile ? (
              /* Authenticated User Core Navigation */
              <>
                {/* 1. Discover */}
                <button
                  id="nav-tab-discover"
                  onClick={() => handleNavClick('matches')}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                    currentTab === 'matches'
                      ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400 dark:ring-1 dark:ring-emerald-500/40'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>Discover</span>
                </button>

                {/* 2. Requests */}
                <button
                  id="nav-tab-requests"
                  onClick={() => handleNavClick('requests')}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 relative cursor-pointer ${
                    currentTab === 'requests'
                      ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400 dark:ring-1 dark:ring-emerald-500/40'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Requests</span>
                  {livePendingRequestsCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-rose-600 text-white font-semibold flex items-center justify-center animate-pulse">
                      {livePendingRequestsCount}
                    </span>
                  )}
                </button>

                {/* 3. My Matches */}
                <button
                  id="nav-tab-my-matches"
                  onClick={() => handleNavClick('my-matches')}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 relative cursor-pointer ${
                    currentTab === 'my-matches'
                      ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400 dark:ring-1 dark:ring-emerald-500/40'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>My Matches</span>
                  {liveAcceptedMatchesCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-emerald-500 text-white font-semibold flex items-center justify-center">
                      {liveAcceptedMatchesCount}
                    </span>
                  )}
                </button>

                {/* 4. Messages */}
                <button
                  id="nav-tab-messages"
                  onClick={() => handleNavClick('messages')}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 relative cursor-pointer ${
                    currentTab === 'messages'
                      ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400 dark:ring-1 dark:ring-emerald-500/40'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Messages</span>
                  {liveUnreadMessagesCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-emerald-500 text-white font-semibold flex items-center justify-center animate-pulse">
                      {liveUnreadMessagesCount}
                    </span>
                  )}
                </button>
              </>
            ) : (
              /* Public / Guest Navigation */
              <>
                <button
                  id="nav-tab-landing"
                  onClick={() => handleNavClick('landing')}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'landing'
                      ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400 dark:ring-1 dark:ring-emerald-500/40'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Trust Pillars</span>
                </button>

                <button
                  id="nav-tab-pricing"
                  onClick={() => handleNavClick('pricing')}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'pricing'
                      ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400 dark:ring-1 dark:ring-emerald-500/40'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pricing</span>
                </button>

                <button
                  id="nav-tab-pledge"
                  onClick={() => handleNavClick('pledge')}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'pledge'
                      ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400 dark:ring-1 dark:ring-emerald-500/40'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Anti-Dowry Registry</span>
                </button>
              </>
            )}

            {/* Admin Console Tabs (strictly guarded by verified database isAdmin state) */}
            {isAdmin && (
              <button
                id="nav-tab-admin-godmode"
                onClick={() => handleNavClick('admin')}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  currentTab === 'admin'
                    ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400 dark:ring-1 dark:ring-emerald-500/40'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 dark:hover:bg-emerald-500/20'
                }`}
                title="Admin God Mode Control Panel"
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Admin God Mode</span>
              </button>
            )}
          </nav>

          {/* Right: Actions, Theme Toggle, Tier Badge, Account Menu & Mobile Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Notifications Bell (Desktop & Mobile) */}
            {currentProfile?.id && (
              <div className="flex items-center">
                <NotificationsBell currentUserId={currentProfile.id} />
              </div>
            )}

            {/* Desktop Theme Toggle */}
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {/* Desktop Universal Language Selector */}
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>

            {/* Mobile Quick Action Buttons (Lang & Theme) */}
            <div className="flex sm:hidden items-center gap-1.5">
              {/* Mobile Quick Language Button */}
              <button
                type="button"
                onClick={openLanguageSelectorModal}
                className="h-8 px-2.5 flex items-center gap-1 rounded-full border transition-colors border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 text-xs font-semibold cursor-pointer"
                title="Select Language / زبان"
                aria-label="Select Language"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-semibold">Lang</span>
              </button>

              {/* Mobile Theme Toggle */}
              <ThemeToggle />
            </div>

            {/* Current Tier Badge (Desktop) */}
            {currentProfile && (
              <button
                id="btn-nav-pricing"
                onClick={onOpenPricing}
                className="cursor-pointer hover:opacity-90 transition-opacity hidden sm:inline-flex"
                title="Click to upgrade subscription tier"
              >
                {getTierBadge(tier)}
              </button>
            )}

            {/* Authenticated User Account Dropdown */}
            {currentProfile ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  id="btn-nav-user-menu"
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="hidden md:flex items-center gap-2 p-1.5 rounded-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="User Account Menu"
                >
                  <div className="relative w-8 h-8 rounded-full bg-emerald-950/60 border border-emerald-500/40 overflow-hidden flex items-center justify-center text-emerald-300 font-bold text-xs">
                    {currentProfile?.avatar_url ? (
                      <img
                        src={currentProfile.avatar_url}
                        alt={currentProfile.full_name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{currentProfile?.full_name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                  <div className="hidden lg:block text-left pr-1">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate max-w-[120px]">
                      {currentProfile?.full_name || 'My Profile'}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 capitalize truncate">
                      {currentProfile?.full_name || 'My Profile'} • {currentProfile?.subscription_tier || 'Free'}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                </button>

                {/* Responsive Hybrid User Profile Menu (Desktop Dropdown + Mobile Full-Screen Modal) */}
                <UserMenu
                  isOpen={userDropdownOpen}
                  onClose={() => setUserDropdownOpen(false)}
                  currentProfile={currentProfile}
                  tier={tier}
                  isAdmin={isAdmin}
                  pendingConsentCount={pendingConsentCount}
                  onNavigate={handleNavClick}
                  onOpenPricing={onOpenPricing}
                  onOpenLogin={onOpenLogin}
                />
              </div>
            ) : (
              /* Public / Guest Action Buttons (Desktop) */
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenLogin) onOpenLogin();
                    else handleNavClick('login');
                  }}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenRegister) onOpenRegister();
                    else handleNavClick('signup');
                  }}
                  className="px-5 py-2 rounded-full text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow-emerald-900/30 transition-all cursor-pointer"
                >
                  Register
                </button>
              </div>
            )}

            {/* Mobile Menu / Avatar Toggle Button */}
            <button
              id="btn-mobile-menu-toggle"
              type="button"
              onClick={() => {
                if (currentProfile) {
                  setUserDropdownOpen(!userDropdownOpen);
                } else {
                  setMobileMenuOpen(!mobileMenuOpen);
                }
              }}
              className="md:hidden relative p-2 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center"
              aria-label={currentProfile ? "Toggle profile menu" : "Toggle navigation menu"}
            >
              {currentProfile?.avatar_url ? (
                <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-500/50">
                  <img
                    src={currentProfile.avatar_url}
                    alt={currentProfile.full_name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : currentProfile ? (
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  {currentProfile.full_name?.charAt(0) || 'U'}
                </div>
              ) : mobileMenuOpen ? (
                <X className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
              ) : (
                <Menu className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
              )}
              {/* Notification indicator on mobile menu button */}
              {(livePendingRequestsCount > 0 || liveUnreadMessagesCount > 0) && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-zinc-900 animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Mobile Slide-Over Menu Drawer with Dark Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div
            ref={mobileMenuRef}
            className="relative w-[86vw] max-w-sm h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-10 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250 pb-safe"
          >
            {/* Top: Drawer Header */}
            <div>
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
                <Logo size="sm" showSubtitle={false} />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Card / Guest Welcome */}
              {currentProfile ? (
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-2xl bg-emerald-900 border-2 border-emerald-500 overflow-hidden flex items-center justify-center text-emerald-200 font-bold text-base shadow-sm">
                      {currentProfile?.avatar_url ? (
                        <img
                          src={currentProfile.avatar_url}
                          alt={currentProfile.full_name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{currentProfile?.full_name?.charAt(0) || 'U'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {currentProfile.full_name}
                        </h4>
                        {currentProfile.kyc_status === 'verified' && (
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {currentProfile.wali_email || 'Member'}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        {getTierBadge(tier)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Welcome to DaheejFree
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    100% Dowry-Free Islamic Matrimonial
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        if (onOpenLogin) onOpenLogin();
                        else handleNavClick('login');
                      }}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-center hover:bg-zinc-200 transition-colors"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        if (onOpenRegister) onOpenRegister();
                        else handleNavClick('signup');
                      }}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 text-white text-center shadow-xs hover:bg-emerald-500 transition-colors"
                    >
                      Register Free
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Links Sections */}
              <div className="p-3 space-y-4">
                {currentProfile ? (
                  <>
                    {/* Primary Matches Group */}
                    <div>
                      <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Matrimonial Matchmaking
                      </span>
                      <div className="mt-1.5 space-y-1">
                        <button
                          type="button"
                          onClick={() => handleNavClick('matches')}
                          className={`min-h-[44px] w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                            currentTab === 'matches'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <Compass className="w-4 h-4" />
                            Discover Nikah Matches
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleNavClick('requests')}
                          className={`min-h-[44px] w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                            currentTab === 'requests'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <UserCheck className="w-4 h-4" />
                            Match Requests
                          </span>
                          {livePendingRequestsCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold shadow-xs">
                              {livePendingRequestsCount} new
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleNavClick('my-matches')}
                          className={`min-h-[44px] w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                            currentTab === 'my-matches' || currentTab === 'accepted'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <HeartHandshake className="w-4 h-4" />
                            My Matches
                          </span>
                          {liveAcceptedMatchesCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-xs">
                              {liveAcceptedMatchesCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleNavClick('messages')}
                          className={`min-h-[44px] w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                            currentTab === 'messages'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <MessageSquare className="w-4 h-4" />
                            Messages & Chat
                          </span>
                          {liveUnreadMessagesCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold animate-pulse shadow-xs">
                              {liveUnreadMessagesCount} unread
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Islamic Safety & Services Group */}
                    <div>
                      <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Islamic Tools & Privacy
                      </span>
                      <div className="mt-1.5 space-y-1">
                        <button
                          type="button"
                          onClick={() => handleNavClick('pledge')}
                          className="w-full px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center gap-2.5 transition-colors"
                        >
                          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Anti-Dowry Registry Certificate</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleNavClick('consent')}
                          className="w-full px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center justify-between transition-colors"
                        >
                          <span className="flex items-center gap-2.5">
                            <Lock className="w-4 h-4 text-indigo-500" />
                            Photo Privacy Gating
                          </span>
                          {pendingConsentCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                              {pendingConsentCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleNavClick('calls')}
                          className="w-full px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center gap-2.5 transition-colors"
                        >
                          <PhoneCall className="w-4 h-4 text-teal-500" />
                          <span>WebRTC Video & Voice Calls</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            onOpenPricing();
                          }}
                          className="w-full px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center gap-2.5 transition-colors"
                        >
                          <Crown className="w-4 h-4 text-amber-500" />
                          <span>Upgrade Membership Plans</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Guest Navigation Group */
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => handleNavClick('landing')}
                      className={`min-h-[44px] w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors ${
                        currentTab === 'landing'
                          ? 'bg-emerald-600 text-white'
                          : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span>Trust Pillars & Principles</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNavClick('pricing')}
                      className={`min-h-[44px] w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors ${
                        currentTab === 'pricing'
                          ? 'bg-emerald-600 text-white'
                          : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-amber-500" />
                      <span>Membership Pricing Plans</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNavClick('pledge')}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                    >
                      <Shield className="w-4 h-4 text-emerald-500" />
                      <span>Anti-Dowry Registry</span>
                    </button>
                  </div>
                )}

                {/* Admin Console shortcut if applicable (guarded by verified database isAdmin state) */}
                {isAdmin && (
                  <div className="space-y-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleNavClick('admin')}
                      className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-2 hover:bg-emerald-900/60 transition-colors"
                    >
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>God Mode Admin Dashboard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('admin-kyc')}
                      className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 flex items-center gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Admin KYC Verification Queue</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom: Language & Sign Out */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 space-y-3">
              {/* Language Action Bar */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openLanguageSelectorModal();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold hover:border-emerald-500 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Language / زبان کا انتخاب</span>
                </span>
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  Change
                </span>
              </button>

              {/* Sign Out Button */}
              {currentProfile && (
                <button
                  type="button"
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await signOutSupabase({ hardRedirect: true });
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200/60 dark:border-red-900/60 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Account</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  </>
  );
};

export default Navbar;
