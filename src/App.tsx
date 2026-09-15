// ==============================================================================
// DAHEEJFREE MATRIMONIAL PLATFORM - ROOT APPLICATION COMPONENT
// ==============================================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  Shield,
  ShieldAlert,
  Heart,
  Crown,
  Lock,
  CheckCircle,
  Eye,
  Phone,
  Video,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useWebRTC } from './hooks/useWebRTC';
import { usePhotoConsent } from './hooks/usePhotoConsent';
import { useConnections } from './hooks/useConnections';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ProfileCard } from './components/profiles/ProfileCard';
import { ProfileGridSkeleton } from './components/profiles/ProfileSkeleton';
import { PhotoConsentModal } from './components/profiles/PhotoConsentModal';
import { WaliContactModal } from './components/profiles/WaliContactModal';
import { CallModal } from './components/webrtc/CallModal';
import { SubscriptionModal } from './components/subscriptions/SubscriptionModal';
import { PricingView } from './components/pricing/PricingView';
import { MatchRequestsView } from './components/requests/MatchRequestsView';
import { AcceptedMatchesView } from './components/matches/AcceptedMatchesView';
import { ChatWindow } from './components/chat/ChatWindow';
import { MessagesPage } from './components/chat/MessagesPage';
import { ConsentManager } from './components/dashboard/ConsentManager';
import { CallsHistory } from './components/dashboard/CallsHistory';
import { KYCVerification } from './components/dashboard/KYCVerification';
import { DowryFreePledge } from './components/dashboard/DowryFreePledge';
import { GoogleFastRegisterModal } from './components/auth/GoogleFastRegisterModal';
import { GlobalCallPopup } from './components/GlobalCallPopup';
import { GlobalNotificationListener } from './components/notifications/GlobalNotificationListener';
import { PrivacyAntiScreenshotGuard } from './components/privacy/PrivacyAntiScreenshotGuard';
import { IslamicOathModal } from './components/oath/IslamicOathModal';
import { PrayerTimeWidget } from './components/prayer/PrayerTimeWidget';
import { PrayerTimeModal } from './components/prayer/PrayerTimeModal';
import { PrayerQuickBanner } from './components/prayer/PrayerQuickBanner';
import LandingGatewayPage from './app/page';
import WebRTCCallsRoutePage from './app/calls/page';
import LoginPage from './app/(auth)/login/page';
import SignupPage from './app/(auth)/signup/page';
import RegisterPage from './app/(auth)/register/page';
import ForgotPasswordPage from './app/forgot-password/page';
import ResetPasswordPage from './app/reset-password/page';
import AdminKYCReviewPage from './app/(admin)/kyc-review/page';
import AdminControlPanel from './app/admin/page';
import KYCPendingPage from './app/(dashboard)/profile/kyc-pending/page';
import OnboardingPage from './app/onboarding/page';
import AuthCallbackPage from './app/auth/callback/page';
import CallPage from './app/call/[roomID]/page';
import TermsOfServicePage from './app/terms/page';
import PrivacyPolicyPage from './app/privacy/page';
import RefundPolicyPage from './app/refund/page';
import LegalHubPage from './app/legal/page';
import VerificationDisclaimerPage from './app/disclaimer/page';
import { sendCallInvite } from './lib/callSignaling';
import { HardKYCGate } from './components/kyc/HardKYCGate';
import { OnboardingGuard, hasAcceptedLegalConsent } from './components/auth/OnboardingGuard';
import { GoogleTranslateBridge } from './components/common/GoogleTranslateBridge';
import { ProfileSecureView, SubscriptionTier } from './types';
import { daheejStore } from './lib/supabase/store';
import { supabase } from './lib/supabase/client';

export default function App() {
  // Authentication & active persona state
  const {
    profile: currentProfile,
    tier,
    allProfiles,
    isLoading,
    switchUser,
    signOut,
    updateCurrentProfile,
    submitKYC,
    refreshState,
  } = useAuth();

  // Compute initial tab from window location (e.g. if redirected to /matches, /messages, /calls, etc.)
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/^\//, '').split('/')[0];
      const fullPath = window.location.pathname.replace(/^\//, '');
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      if (tabParam) return tabParam;
      if (fullPath.startsWith('auth') || path === 'auth' || path === 'callback') {
        return 'auth-callback';
      }
      if (fullPath.startsWith('call') || path === 'call') {
        return 'call';
      }
      if (path === 'dashboard') {
        return 'matches';
      }
      const validPaths = [
        'matches',
        'requests',
        'my-matches',
        'accepted',
        'messages',
        'calls',
        'call',
        'consent',
        'pricing',
        'pledge',
        'profile',
        'prayer',
        'prayer-times',
        'login',
        'signup',
        'register',
        'forgot-password',
        'reset-password',
        'onboarding',
        'admin',
        'admin-kyc',
        'kyc-pending',
        'terms',
        'privacy',
        'refund',
        'legal',
        'disclaimer',
      ];
      if (validPaths.includes(path)) {
        return path;
      }
    }
    return 'landing';
  });

  // Extract selected chat user ID if navigating to /messages/:id or /messages?user=:id
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const userParam = searchParams.get('user') || searchParams.get('id') || searchParams.get('partner');
      if (userParam) return userParam;
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (parts[0] === 'messages' && parts[1]) {
        return parts[1];
      }
    }
    return null;
  });

  // Track if mobile 1-on-1 chat is actively open to hide mobile bottom bar for 100% writing visibility
  const [isMobileChatActive, setIsMobileChatActive] = useState<boolean>(Boolean(selectedChatUserId));

  // Keep browser history and URL pathname in sync with currentTab without destroying path parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname.replace(/^\//, '').split('/')[0];
      // Do not overwrite dynamic paths like /call/room_123 or /messages/user_123
      if (currentTab === 'call' && window.location.pathname.startsWith('/call')) {
        return;
      }
      if (currentTab === 'messages' && window.location.pathname.startsWith('/messages/')) {
        return;
      }
      const targetPath = currentTab === 'landing' ? '/' : `/${currentTab}`;
      if (currentPath !== currentTab && (currentTab !== 'landing' || currentPath !== '')) {
        window.history.pushState({ tab: currentTab }, '', targetPath);
      }
    }
  }, [currentTab]);

  // Handle browser back/forward buttons and router navigation
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname.replace(/^\//, '').split('/')[0];
        const fullPath = window.location.pathname.replace(/^\//, '');
        const searchParams = new URLSearchParams(window.location.search);
        const tabParam = searchParams.get('tab');
        if (tabParam) {
          setCurrentTab(tabParam);
        } else if (fullPath.startsWith('auth') || path === 'auth' || path === 'callback') {
          setCurrentTab('auth-callback');
        } else if (fullPath.startsWith('call') || path === 'call') {
          setCurrentTab('call');
        } else if (path === 'dashboard') {
          setCurrentTab('matches');
        } else if (path) {
          setCurrentTab(path);
          if (path === 'messages') {
            const parts = window.location.pathname.split('/').filter(Boolean);
            if (parts[1]) {
              setSelectedChatUserId(parts[1]);
            } else {
              const userParam = searchParams.get('user') || searchParams.get('id') || searchParams.get('partner');
              if (userParam) setSelectedChatUserId(userParam);
            }
          }
        } else {
          setCurrentTab('landing');
        }
      }
    };

    const handleCustomNavigate = (e: Event) => {
      const customEvt = e as CustomEvent<{ path?: string; tab?: string; userId?: string }>;
      if (customEvt.detail?.tab) {
        let newTab = customEvt.detail.tab;
        if (newTab.startsWith('call')) {
          newTab = 'call';
        }
        setCurrentTab(newTab);
      }
      if (customEvt.detail?.userId) {
        setSelectedChatUserId(customEvt.detail.userId);
      }
    };

    const handleCustomRefresh = () => {
      refreshState();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('app:navigate', handleCustomNavigate);
    window.addEventListener('app:refresh', handleCustomRefresh);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('app:navigate', handleCustomNavigate);
      window.removeEventListener('app:refresh', handleCustomRefresh);
    };
  }, [refreshState]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [kycOnly, setKycOnly] = useState<boolean>(false);
  const [isPricingOpen, setIsPricingOpen] = useState<boolean>(false);
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState<boolean>(false);
  const [activeWaliProfile, setActiveWaliProfile] = useState<ProfileSecureView | null>(null);
  const [activeConsentProfile, setActiveConsentProfile] = useState<ProfileSecureView | null>(null);
  const [activeChatProfile, setActiveChatProfile] = useState<ProfileSecureView | null>(null);

  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [acceptedMatchesCount, setAcceptedMatchesCount] = useState<number>(0);
  const [googleFastUser, setGoogleFastUser] = useState<{ name: string; email: string; avatar_url?: string } | null>(null);
  const currentUserId = currentProfile?.id || null;
  const isLocalCovenantSigned = typeof window !== 'undefined' && (
    localStorage.getItem('covenant_signed') === 'true' ||
    localStorage.getItem('islamic_oath_signed') === 'true' ||
    localStorage.getItem('policies_accepted') === 'true'
  );
  const isOathRequired = Boolean(
    currentProfile &&
    !currentProfile.islamic_oath_signed &&
    !currentProfile.covenant_signed &&
    !isLocalCovenantSigned
  );

  // Track incoming match requests & accepted matches count reactively with Supabase Realtime
  useEffect(() => {
    if (!currentUserId) {
      setPendingRequestsCount(0);
      setAcceptedMatchesCount(0);
      return;
    }

    const updateConnectionCounts = () => {
      const conns = daheejStore.getConnectionsForUser(currentUserId);
      const incomingPending = conns.filter(
        (c) => c.receiver_id === currentUserId && c.status === 'pending'
      ).length;
      const acceptedCount = conns.filter((c) => c.status === 'accepted').length;

      setPendingRequestsCount(incomingPending);
      setAcceptedMatchesCount(acceptedCount);
    };

    updateConnectionCounts();

    // 1. Local store subscription
    const unsubscribeStore = daheejStore.subscribe((event) => {
      if (event.table === 'connections') {
        updateConnectionCounts();
      }
    });

    // 2. Fetch initial count from Supabase
    const fetchRemoteRequests = async () => {
      try {
        const { data, error } = await supabase
          .from('connections')
          .select('*')
          .or(`receiver_id.eq.${currentUserId},sender_id.eq.${currentUserId}`);

        if (!error && data) {
          data.forEach((conn) => daheejStore.setConnectionFromRemote(conn));
          updateConnectionCounts();
        }
      } catch (err) {
        console.warn('Initial connections fetch note:', err);
      }
    };

    fetchRemoteRequests();

    // 3. Supabase Realtime channel for instant notification badge (unique channel ID)
    const channelId = `connections_badges_${currentUserId}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
        },
        (payload) => {
          if (payload.new) {
            const conn = payload.new as any as any;
            if (conn.receiver_id === currentUserId || conn.sender_id === currentUserId) {
              daheejStore.setConnectionFromRemote(conn);
              updateConnectionCounts();
            }
          }
        }
      )
      .subscribe();

    return () => {
      unsubscribeStore();
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Track unread messages count reactively
  useEffect(() => {
    if (!currentUserId) {
      setUnreadMessagesCount(0);
      return;
    }

    const updateCount = () => {
      const count = daheejStore.getUnreadCountForUser(currentUserId);
      setUnreadMessagesCount(count);
    };

    updateCount();

    const unsubscribe = daheejStore.subscribeToMessages(() => {
      updateCount();
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId]);

  // Strict route protection & redirection rules
  useEffect(() => {
    // Prevent premature redirects while session / auth state is still resolving or during auth callback or live call
    if (isLoading || currentTab === 'auth-callback' || currentTab === 'call') return;

    // 1. Mandatory Legal Consent & Onboarding Enforcement (Module 1):
    // For all authenticated accounts including Google OAuth users:
    // Check legal agreement flags: terms_accepted, privacy_policy_accepted, anti_dowry_pledged
    const isLegalConsentPending =
      currentUserId &&
      currentProfile &&
      (!currentProfile.terms_accepted ||
        !(currentProfile.privacy_policy_accepted || currentProfile.privacy_accepted) ||
        !(currentProfile.anti_dowry_pledged || currentProfile.anti_dowry_pledge));

    const needsOnboarding =
      currentUserId &&
      currentProfile &&
      (Boolean(isLegalConsentPending) ||
        currentProfile.is_onboarded === false ||
        !currentProfile.avatar_url ||
        !currentProfile.profession ||
        !currentProfile.wali_name ||
        !currentProfile.wali_phone);

    if (needsOnboarding && currentTab !== 'onboarding' && currentTab !== 'reset-password' && currentTab !== 'auth-callback') {
      setCurrentTab('onboarding');
      return;
    }

    // 2. If authenticated, fully onboarded, and on landing/pillars/home/login/signup/onboarding -> auto-redirect to matches dashboard
    const publicHomeTabs = ['landing', 'pillars', 'home', 'login', 'signup', 'onboarding'];
    if (currentUserId && !needsOnboarding && publicHomeTabs.includes(currentTab)) {
      setCurrentTab('matches');
    }

    // 3. Protected internal routes: matches, messages, consent, calls, profile, kyc-pending, onboarding
    const protectedTabs = ['matches', 'messages', 'consent', 'calls', 'profile', 'kyc-pending', 'onboarding'];
    if (!currentUserId && protectedTabs.includes(currentTab)) {
      setCurrentTab('login');
    }

    // 4. Admin console: strictly restricted to admin role, is_admin flag, or superadmin emails
    const isAdmin = Boolean(
      currentProfile && (
        currentProfile.id === 'admin' ||
        (currentProfile as any).is_admin === true ||
        (currentProfile as any).role === 'admin' ||
        currentProfile.wali_email === 'admin@daheejfree.com' ||
        currentProfile.wali_email === 'behumble7860@gmail.com' ||
        currentProfile.wali_email === 'hasnainkhan3177@gmail.com'
      )
    );

    // Only redirect once loading is finished and profile has been evaluated
    if (!isLoading) {
      if ((currentTab === 'admin' || currentTab === 'admin-kyc')) {
        if (!currentUserId) {
          setCurrentTab('login');
        } else if (currentProfile && !isAdmin) {
          setCurrentTab('matches');
        }
      }
    }
  }, [currentUserId, currentProfile, currentTab, isLoading]);


  // 2-Way Photo Privacy & Consent engine
  const {
    inboundRequests,
    outboundRequests,
    hasPhotoAccess,
    getConsentStatus,
    sendRequest,
    acceptRequest,
    rejectRequest,
    revokeConsent,
    grantInstantConsent,
  } = usePhotoConsent(currentUserId);

  // Mutual Match Connections & Feature Gating Engine
  const {
    getConnectionPairStatus,
    sendMatchRequest,
    respondToMatch,
  } = useConnections(currentUserId);

  const [supabaseProfiles, setSupabaseProfiles] = useState<any[]>([]);
  const [isMatchesLoading, setIsMatchesLoading] = useState<boolean>(false);

  // Initiates high-fidelity WebRTC call via signaling and routes to dedicated Call Room
  const handleStartCall = useCallback(
    async (targetUserId: string, callType: 'voice' | 'video' | 'audio' = 'video') => {
      if (!currentUserId || !targetUserId) return;
      try {
        const normalizedType = (callType === 'voice' || callType === 'audio') ? 'voice' : 'video';
        const callerName = currentProfile?.full_name || 'Matched Partner';
        const { roomID } = await sendCallInvite({
          currentUserId,
          partnerId: targetUserId,
          callerName,
          callType: normalizedType,
        });
        const callUrl = `/call/${roomID}?callType=${normalizedType}&role=caller&partnerId=${targetUserId}`;
        if (typeof window !== 'undefined') {
          window.history.pushState({ tab: 'call' }, '', callUrl);
          window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: callUrl, tab: 'call' } }));
        }
        setCurrentTab('call');
      } catch (err) {
        console.error('[App] Failed to initiate call:', err);
      }
    },
    [currentUserId, currentProfile]
  );

  // Navigates receiver into active Call Room on incoming call acceptance
  const navigateToCall = useCallback((roomId: string, callData?: any) => {
    const callType = callData?.call_type || 'video';
    const partnerId = callData?.caller_id || '';
    const partnerName = callData?.caller_name || '';
    const callUrl = `/call/${roomId}?callType=${callType}&role=receiver${partnerId ? `&partnerId=${partnerId}` : ''}${partnerName ? `&partnerName=${encodeURIComponent(partnerName)}` : ''}`;
    
    if (typeof window !== 'undefined') {
      window.history.pushState({ tab: 'call' }, '', callUrl);
      window.dispatchEvent(
        new CustomEvent('app:navigate', {
          detail: { tab: 'call', path: callUrl, roomId, role: 'receiver' },
        })
      );
    }
    setCurrentTab('call');
  }, []);

  // Fetch live profiles directly from Supabase profiles table
  useEffect(() => {
    if (!currentUserId) {
      setSupabaseProfiles([]);
      return;
    }

    let isMounted = true;
    async function fetchMatches() {
      setIsMatchesLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', currentUserId);

        if (error) {
          console.error('Error fetching matches from Supabase:', error);
        } else if (data && isMounted) {
          setSupabaseProfiles(data);
        }
      } catch (err) {
        console.error('Supabase query error:', err);
      } finally {
        if (isMounted) setIsMatchesLoading(false);
      }
    }

    fetchMatches();
    return () => {
      isMounted = false;
    };
  }, [currentUserId, currentProfile?.updated_at, currentProfile?.subscription_tier]);

  // Filter and compute secure profile views based on Supabase database data and opposite gender matching
  const secureProfiles = useMemo(() => {
    const effectiveViewerId = currentUserId || '';
    if (!effectiveViewerId) return [];

    const rawProfiles = supabaseProfiles.length > 0
      ? supabaseProfiles
      : daheejStore.getProfiles().filter((p) => p.id !== currentUserId);

    const mapped: ProfileSecureView[] = rawProfiles.map((p) => {
      const hasConsent = hasPhotoAccess(p.id);
      const isDiamond = tier === 'diamond';
      const normGender = (p.gender === 'male' || p.gender === 'Brother') ? 'male' : 'female';

      return {
        id: p.id,
        full_name: p.full_name || 'Candidate',
        gender: normGender,
        age: p.age || 24,
        profession: p.profession || 'Not Specified',
        location: p.city || p.location || 'Not Specified',
        city: p.city || p.location || 'Not Specified',
        kyc_status: p.kyc_status || 'pending',
        subscription_tier: (p.subscription_tier as SubscriptionTier) || 'free',
        anti_dowry_pledged: Boolean(p.anti_dowry_pledge ?? p.anti_dowry_pledged ?? true),
        avatar_url: p.avatar_url || (normGender === 'female' ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80' : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80'),
        photo_blur_hash: p.photo_blur_hash || 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
        has_photo_consent: hasConsent,
        is_photo_unlocked: hasConsent || p.photo_privacy === false,
        photo_access_granted: hasConsent || p.photo_privacy === false,
        photo_privacy: p.photo_privacy !== undefined ? p.photo_privacy : true,
        photo_privacy_mode: p.photo_privacy_mode || 'blur_all',
        wali_name: p.wali_name || null,
        wali_phone: p.wali_phone || null,
        wali_email: isDiamond ? (p.wali_email || `${p.id}@daheejfree.org`) : (p.wali_email || null),
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString(),
      };
    });

    const myGender = currentProfile?.gender === 'male' ? 'male' : 'female';
    const targetGender = myGender === 'male' ? 'female' : 'male';

    return mapped.filter((p) => {
      // Exclude self and banned profiles
      if (p.id === currentUserId || p.kyc_status === 'banned') return false;

      // Filter by gender: default 'all' shows opposite gender
      if (genderFilter === 'all') {
        if (currentProfile?.gender && p.gender !== targetGender) {
          return false;
        }
      } else {
        if (p.gender !== genderFilter) return false;
      }

      // Filter by KYC verification
      if (kycOnly && p.kyc_status !== 'verified') {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = p.full_name.toLowerCase().includes(query);
        const matchesProfession = p.profession?.toLowerCase().includes(query) || false;
        const matchesLocation = p.location?.toLowerCase().includes(query) || false;
        return matchesName || matchesProfession || matchesLocation;
      }

      return true;
    });
  }, [currentUserId, supabaseProfiles, currentProfile, tier, genderFilter, kycOnly, searchTerm, hasPhotoAccess]);

  const pendingInboundCount = inboundRequests.filter((r) => r.status === 'pending').length;

  // Dedicated full-screen View for live ZegoCloud 1-on-1 calls
  // (Moved inside the main router to preserve the unified layout)

  return (
    <div className={`${currentTab === 'messages' || currentTab === 'call' ? 'h-[100dvh] max-h-[100dvh]' : 'min-h-[100dvh]'} overflow-x-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white dark:selection:text-zinc-950 transition-colors duration-200`}>
      <GoogleTranslateBridge />
      {/* Legal Consent & Onboarding Guard (Module 1) */}
      <OnboardingGuard
        currentUserId={currentUserId}
        currentProfile={currentProfile}
        currentTab={currentTab}
        onRedirectToOnboarding={() => setCurrentTab('onboarding')}
        onProfileUpdated={(updated) => updateCurrentProfile(updated)}
      />

      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab !== 'messages') {
            setIsMobileChatActive(false);
          }
          setCurrentTab(tab);
        }}
        currentProfile={currentProfile}
        tier={tier}
        allProfiles={allProfiles}
        onSwitchUser={switchUser}
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenLogin={() => setCurrentTab('login')}
        onOpenRegister={() => setCurrentTab('signup')}
        onOpenPrayerTimes={() => setIsPrayerModalOpen(true)}
        pendingConsentCount={pendingInboundCount}
        unreadMessagesCount={unreadMessagesCount}
        pendingRequestsCount={pendingRequestsCount}
        acceptedMatchesCount={acceptedMatchesCount}
        hideMobileNav={currentTab === 'call' || (currentTab === 'messages' && isMobileChatActive)}
        isNavigationLocked={Boolean(
          currentUserId &&
          currentProfile &&
          (!currentProfile.terms_accepted ||
            !(currentProfile.privacy_policy_accepted || currentProfile.privacy_accepted) ||
            !(currentProfile.anti_dowry_pledged || currentProfile.anti_dowry_pledge) ||
            currentProfile.is_onboarded === false ||
            !currentProfile.avatar_url ||
            !currentProfile.profession ||
            !currentProfile.wali_name ||
            !currentProfile.wali_phone)
        )}
      />

      {/* Strict Production Hard KYC Wall: un-dismissible full-screen gate for unverified users trying to access protected views */}
      {currentProfile && 
        currentProfile.kyc_status !== 'verified' && 
        !currentProfile.selfie_verified && 
        !currentProfile.is_verified && 
        ['matches', 'requests', 'my-matches', 'accepted', 'messages', 'calls', 'call', 'consent'].includes(currentTab) && (
        <HardKYCGate
          currentProfile={currentProfile}
          onRefreshProfile={refreshState}
          onSignOut={signOut}
          onUpdateProfile={updateCurrentProfile}
        />
      )}

      {/* Persistent KYC Status Alert on non-restricted views (e.g., profile settings) */}
      {currentProfile && 
        currentProfile.kyc_status !== 'verified' && 
        !currentProfile.selfie_verified && 
        !currentProfile.is_verified && 
        currentTab === 'profile' && (
        <div id="unverified-kyc-banner" className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2.5 sm:py-3 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
              <span>
                <strong>Action Required:</strong> Your profile is pending Identity Verification. Complete your Government ID or Live Biometric verification to unlock all platform features.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="verify-kyc-banner-btn"
                onClick={() => setCurrentTab('profile')}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <span>Complete Verification Below</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Realtime Fullscreen Incoming Call Interruption Popup */}
      <GlobalCallPopup />

      {/* Global Realtime Notification & Message Alert Engine */}
      <GlobalNotificationListener
        currentUserId={currentUserId}
        onNavigateToChat={(partnerId) => {
          setSelectedChatUserId(partnerId);
          setCurrentTab('messages');
        }}
        onNavigateToCall={(roomId, type) => {
          setCurrentTab('call');
        }}
      />

      {/* Main View Router */}
      <main
        className={
          currentTab === 'messages'
            ? 'flex-1 min-h-0 w-full max-w-7xl mx-auto px-0 sm:px-3 py-0 sm:py-1 flex flex-col overflow-hidden'
            : currentTab === 'call'
            ? 'flex-1 min-h-0 w-full flex flex-col overflow-hidden p-0'
            : 'flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-8'
        }
      >
        {/* Tab 0: Root Landing Gateway & 4 Pillars of Trust */}
        {currentTab === 'landing' && (
          <LandingGatewayPage
            onExploreMatches={() => setCurrentTab('matches')}
            onOpenPricing={() => setIsPricingOpen(true)}
            onOpenRegister={() => setCurrentTab('signup')}
            onOpenPledge={() => setCurrentTab('pledge')}
            isAuthenticated={Boolean(currentUserId)}
          />
        )}

        {/* Tab - Auth: Login */}
        {currentTab === 'login' && (
          <LoginPage
            onSuccess={(userId) => {
              switchUser(userId);
              setCurrentTab('matches');
            }}
            onNavigateSignup={() => setCurrentTab('signup')}
          />
        )}

        {/* Tab - Auth: Signup */}
        {currentTab === 'signup' && (
          <SignupPage
            onSuccess={(userId) => {
              switchUser(userId);
              setCurrentTab('matches');
            }}
            onNavigateLogin={() => setCurrentTab('login')}
          />
        )}

        {/* Tab - Auth: Comprehensive Onboarding & KYC Wizard */}
        {currentTab === 'register' && <RegisterPage />}

        {/* Tab - Auth: Forgot Password */}
        {currentTab === 'forgot-password' && <ForgotPasswordPage />}

        {/* Tab - Auth: Reset Password */}
        {currentTab === 'reset-password' && <ResetPasswordPage />}

        {/* Tab 1: Nikah Matches (Explorer) */}
        {currentTab === 'matches' && (
          <div className="space-y-6">
            {/* Islamic Prayer Times Ambient Quick Banner */}
            <PrayerQuickBanner
              userCity={currentProfile?.city || currentProfile?.location}
              onOpenFullWidget={() => setIsPrayerModalOpen(true)}
            />

            {/* Search & Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-3.5 sm:p-5 shadow-sm dark:shadow-xl transition-colors">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative w-full lg:w-96">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, profession, city..."
                    className="w-full bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-200 pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                  {/* Gender Filter Segmented Control */}
                  <div className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 grid grid-cols-3 gap-1 text-xs">
                    <button
                      onClick={() => setGenderFilter('all')}
                      className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all ${
                        genderFilter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setGenderFilter('female')}
                      className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all ${
                        genderFilter === 'female' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      Sisters (Brides)
                    </button>
                    <button
                      onClick={() => setGenderFilter('male')}
                      className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all ${
                        genderFilter === 'male' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      Brothers (Grooms)
                    </button>
                  </div>

                  {/* KYC Toggle */}
                  <button
                    onClick={() => setKycOnly(!kycOnly)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      kycOnly
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Verified KYC Only</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Profiles View */}
            {isLoading || isMatchesLoading ? (
              <ProfileGridSkeleton count={6} />
            ) : secureProfiles.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center shadow-sm">
                <Users className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">No matching profiles found</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Try adjusting your search criteria or gender filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {secureProfiles.map((p) => (
                  <ProfileCard
                    key={p.id}
                    profile={p}
                    viewerTier={tier}
                    viewerProfile={currentProfile || ({} as any)}
                    isSelf={p.id === currentUserId}
                    consentStatus={getConsentStatus(p.id)}
                    connectionPairStatus={getConnectionPairStatus(p.id)}
                    onSendConnectionRequest={sendMatchRequest}
                    onRespondConnection={respondToMatch}
                    onSendConsentRequest={(targetId) => {
                      setActiveConsentProfile(p);
                    }}
                    onOpenWaliModal={setActiveWaliProfile}
                    onOpenPricing={() => setIsPricingOpen(true)}
                    onStartCall={handleStartCall}
                    onOpenChat={(profile) => {
                      setSelectedChatUserId(profile.id);
                      setCurrentTab('messages');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Real-Time Match Proposals & Requests */}
        {currentTab === 'requests' && (
          <MatchRequestsView
            currentUserId={currentUserId}
            currentProfile={currentProfile}
            tier={tier}
            allProfiles={allProfiles}
            onNavigateChat={(partnerId) => {
              setSelectedChatUserId(partnerId);
              setCurrentTab('messages');
            }}
            onOpenPricing={() => setIsPricingOpen(true)}
            onStartCall={handleStartCall}
            onExploreDiscover={() => setCurrentTab('matches')}
          />
        )}

        {/* Tab: Dedicated My Matches (Mutually Accepted Connections) */}
        {(currentTab === 'my-matches' || currentTab === 'accepted') && (
          <AcceptedMatchesView
            currentUserId={currentUserId}
            currentProfile={currentProfile}
            tier={tier}
            allProfiles={allProfiles}
            onNavigateChat={(partnerId) => {
              setSelectedChatUserId(partnerId);
              setCurrentTab('messages');
            }}
            onOpenPricing={() => setIsPricingOpen(true)}
            onStartCall={handleStartCall}
            onExploreDiscover={() => setCurrentTab('matches')}
          />
        )}

        {/* Tab: Real-Time Matrimonial Messages (Split-Pane Chat) */}
        {currentTab === 'messages' && (
          <MessagesPage
            currentProfile={currentProfile}
            viewerTier={tier}
            allProfiles={allProfiles}
            initialSelectedUserId={selectedChatUserId}
            onStartCall={handleStartCall}
            onOpenPricing={() => setIsPricingOpen(true)}
            onViewProfile={(profile) => {
              // Can inspect candidate details
              setActiveConsentProfile(profile);
            }}
            onNavigateMatches={() => setCurrentTab('matches')}
            onMobileChatStateChange={(isActive) => setIsMobileChatActive(isActive)}
          />
        )}

        {/* Tab 2: Photo Privacy & 2-Way Consent */}
        {currentTab === 'consent' && (
          <ConsentManager
            currentUserId={currentUserId || ''}
            inboundRequests={inboundRequests}
            outboundRequests={outboundRequests}
            onAccept={acceptRequest}
            onReject={rejectRequest}
            onViewProfile={(id) => setCurrentTab('matches')}
          />
        )}

        {/* Tab 3: Pricing & Upgrade Comparison Matrix */}
        {currentTab === 'pricing' && (
          <PricingView
            currentTier={tier}
            currentProfile={currentProfile}
            onSubscriptionUpdated={refreshState}
            onNavigateRegister={() => setCurrentTab('signup')}
          />
        )}

        {/* Tab 4: WebRTC Calls Console */}
        {currentTab === 'calls' && (
          <WebRTCCallsRoutePage />
        )}

        {/* Tab 4.5: Active Call Room */}
        {currentTab === 'call' && (
          <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col h-[100dvh] w-full overflow-hidden">
            <CallPage />
          </div>
        )}

        {/* Tab 5: Anti-Dowry Registry Charter */}
        {currentTab === 'pledge' && (
          <DowryFreePledge
            currentProfile={currentProfile}
            onSignPledge={() => updateCurrentProfile({ anti_dowry_pledged: true })}
          />
        )}

        {/* Tab 6: My Profile & KYC Settings */}
        {currentTab === 'profile' && (
          <KYCVerification
            profile={currentProfile}
            tier={tier}
            onUpdateProfile={updateCurrentProfile}
            onSubmitKYC={submitKYC}
            onOpenPricing={() => setIsPricingOpen(true)}
            onAccountDeleted={() => {
              switchUser('');
              setCurrentTab('landing');
            }}
          />
        )}

        {/* Tab: Islamic Prayer Times & Qibla Direction */}
        {(currentTab === 'prayer' || currentTab === 'prayer-times') && (
          <div className="max-w-4xl mx-auto space-y-6">
            <PrayerTimeWidget
              initialCity={currentProfile?.city || currentProfile?.location || 'Karachi'}
              initialCountry={(currentProfile as any)?.country || 'Location Unknown'}
            />
          </div>
        )}

        {/* Tab 7: Admin Compliance & KYC Queue */}
        {currentTab === 'admin-kyc' && <AdminKYCReviewPage />}

        {/* Tab: God Mode Admin Control Panel */}
        {currentTab === 'admin' && (
          <div className="min-h-screen bg-zinc-950 text-zinc-100 -m-4 sm:-m-6 md:-m-8 p-4 md:p-8">
            <AdminControlPanel />
          </div>
        )}

        {/* Tab 8: KYC Pending Holding Wall */}
        {currentTab === 'kyc-pending' && <KYCPendingPage />}

        {/* Tab 9: Mandatory Matrimonial Onboarding */}
        {currentTab === 'onboarding' && (
          <OnboardingPage
            onSuccess={() => {
              refreshState();
              setCurrentTab('matches');
            }}
          />
        )}

        {/* Tab 10: Supabase OAuth Callback Processing */}
        {currentTab === 'auth-callback' && <AuthCallbackPage />}

        {/* Tab 11: Legal & Shariah Policies */}
        {currentTab === 'terms' && (
          <TermsOfServicePage onBack={() => setCurrentTab(currentProfile ? 'matches' : 'landing')} />
        )}
        {currentTab === 'privacy' && (
          <PrivacyPolicyPage onBack={() => setCurrentTab(currentProfile ? 'matches' : 'landing')} />
        )}
        {currentTab === 'refund' && (
          <RefundPolicyPage onBack={() => setCurrentTab(currentProfile ? 'matches' : 'landing')} />
        )}
        {currentTab === 'legal' && (
          <LegalHubPage />
        )}
        {currentTab === 'disclaimer' && (
          <VerificationDisclaimerPage onBack={() => setCurrentTab(currentProfile ? 'matches' : 'landing')} />
        )}
      </main>

      {/* 2-Way Photo Consent Modal */}
      <PhotoConsentModal
        isOpen={Boolean(activeConsentProfile)}
        onClose={() => setActiveConsentProfile(null)}
        targetProfile={activeConsentProfile}
        consentStatus={activeConsentProfile ? getConsentStatus(activeConsentProfile.id) : 'none'}
        onRequestConsent={(id) => sendRequest(id)}
        onRevokeConsent={(id) => revokeConsent(id)}
        onInstantGrant={(id) => grantInstantConsent(id)}
        onAcceptConsent={(reqId) => acceptRequest(reqId)}
        onRejectConsent={(reqId) => rejectRequest(reqId)}
      />

      {/* WebRTC Video / Voice Modal Overlay Removed in favor of Dedicated Call Room */}

      {/* Direct Wali Contact Modal (Diamond Exclusive) */}
      <WaliContactModal
        targetProfile={activeWaliProfile}
        currentProfile={currentProfile}
        onClose={() => setActiveWaliProfile(null)}
      />

      {/* Realtime Chat Window with Shariah Moderation */}
      {activeChatProfile && (
        <ChatWindow
          currentProfile={currentProfile}
          targetProfile={activeChatProfile}
          viewerTier={tier}
          onClose={() => setActiveChatProfile(null)}
          onStartCall={(targetId, type) => {
            setActiveChatProfile(null);
            handleStartCall(targetId, type === 'audio' ? 'voice' : 'video');
          }}
          onOpenPricing={() => setIsPricingOpen(true)}
        />
      )}

      {/* Subscription Tier Upgrade Modal */}
      <SubscriptionModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        currentTier={tier}
        currentProfile={currentProfile}
        onSubscriptionUpdated={refreshState}
      />

      {/* Google Fast-Track Onboarding Modal */}
      <GoogleFastRegisterModal
        isOpen={Boolean(googleFastUser)}
        onClose={() => setGoogleFastUser(null)}
        googleUser={googleFastUser}
        onSuccess={(newUserId) => {
          switchUser(newUserId);
          setCurrentTab('matches');
        }}
      />

      {/* Privacy & Anti-Screenshot Blur Protection */}
      <PrivacyAntiScreenshotGuard />

      {/* Islamic Oath, Safety & Policies Mandatory Modal Guardrail */}
      {currentProfile && isOathRequired && (
        <IslamicOathModal
          isOpen={isOathRequired}
          currentProfile={currentProfile}
          onOathSigned={() => {
            updateCurrentProfile({
              islamic_oath_signed: true,
              covenant_signed: true,
              covenant_signed_at: new Date().toISOString(),
              anti_dowry_pledged: true,
              terms_accepted: true,
              privacy_accepted: true,
            });
            daheejStore.updateProfile(currentProfile.id, {
              islamic_oath_signed: true,
              covenant_signed: true,
              covenant_signed_at: new Date().toISOString(),
              anti_dowry_pledged: true,
              terms_accepted: true,
              privacy_accepted: true,
            });
            try {
              localStorage.setItem('covenant_signed', 'true');
              localStorage.setItem('islamic_oath_signed', 'true');
              localStorage.setItem('policies_accepted', 'true');
            } catch (e) {}
            refreshState();
          }}
          onDecline={async () => {
            await signOut();
            setCurrentTab('explore');
          }}
          onClose={async () => {
            await signOut();
            setCurrentTab('explore');
          }}
        />
      )}

      {/* Islamic Prayer Times & Qibla Direction Global Modal */}
      <PrayerTimeModal
        isOpen={isPrayerModalOpen}
        onClose={() => setIsPrayerModalOpen(false)}
        initialCity={currentProfile?.city || currentProfile?.location || 'Karachi'}
        initialCountry={(currentProfile as any)?.country || 'Location Unknown'}
      />

      {/* Footer */}
      {currentTab !== 'messages' && currentTab !== 'call' && (
        <Footer onNavigate={(tab) => setCurrentTab(tab)} />
      )}
    </div>
  );
}
