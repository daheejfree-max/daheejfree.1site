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
import { BottomNav } from './components/layout/BottomNav';
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
import MatchesPage from './app/matches/page';
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
  const [isPricingOpen, setIsPricingOpen] = useState<boolean>(false);
  const [activeWaliProfile, setActiveWaliProfile] = useState<ProfileSecureView | null>(null);
  const [activeConsentProfile, setActiveConsentProfile] = useState<ProfileSecureView | null>(null);
  const [activeChatProfile, setActiveChatProfile] = useState<ProfileSecureView | null>(null);

  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [acceptedMatchesCount, setAcceptedMatchesCount] = useState<number>(0);
  const [googleFastUser, setGoogleFastUser] = useState<{ name: string; email: string; avatar_url?: string } | null>(null);
  const currentUserId = currentProfile?.id || null;
  const [sessionUserEmail, setSessionUserEmail] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setSessionUserEmail(data.user.email.toLowerCase());
      }
    });
  }, [currentUserId]);

  const isAdmin = useMemo(() => {
    const verifiedEmail = (sessionUserEmail || (currentProfile as any)?.email || '').toLowerCase().trim();
    const isSuperAdminEmail =
      verifiedEmail === 'hasnainkhan3177@gmail.com' ||
      verifiedEmail === 'behumble7860@gmail.com' ||
      verifiedEmail === 'admin@daheejfree.com';

    if (isSuperAdminEmail) return true;

    return Boolean(
      currentProfile && (currentProfile as any).is_admin === true
    );
  }, [currentProfile, sessionUserEmail]);
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
        !currentProfile.privacy_policy_accepted ||
        !currentProfile.anti_dowry_pledged);

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

    // 4. Admin console: strictly restricted to verified database is_admin flag or superadmin emails
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
  }, [currentUserId, currentProfile, currentTab, isLoading, isAdmin]);


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

  const pendingInboundCount = inboundRequests.filter((r) => r.status === 'pending').length;

  // Dedicated full-screen View for live ZegoCloud 1-on-1 calls
  // (Moved inside the main router to preserve the unified layout)

  return (
    <div className={`${currentTab === 'messages' || currentTab === 'call' ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-[100dvh] overflow-x-hidden'} bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white dark:selection:text-zinc-950 transition-colors duration-200`}>
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
        isAdmin={isAdmin}
        tier={tier}
        allProfiles={allProfiles}
        onSwitchUser={switchUser}
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenLogin={() => setCurrentTab('login')}
        onOpenRegister={() => setCurrentTab('signup')}
        pendingConsentCount={pendingInboundCount}
        unreadMessagesCount={unreadMessagesCount}
        pendingRequestsCount={pendingRequestsCount}
        acceptedMatchesCount={acceptedMatchesCount}
        hideMobileNav={currentTab === 'call' || (currentTab === 'messages' && isMobileChatActive)}
        isNavigationLocked={Boolean(
          currentUserId &&
          currentProfile &&
          (!currentProfile.terms_accepted ||
            !currentProfile.privacy_policy_accepted ||
            !currentProfile.anti_dowry_pledged ||
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
            ? 'h-[100dvh] w-full overflow-hidden overscroll-none fixed inset-0 z-40 bg-zinc-50 dark:bg-zinc-950 flex flex-col'
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

        {/* Tab 1: Nikah Matches (Explorer / Discover) */}
        {(currentTab === 'matches' || currentTab === 'discover') && (
          <MatchesPage
            onNavigateChat={(partnerId) => {
              setSelectedChatUserId(partnerId);
              setCurrentTab('messages');
            }}
            onOpenPricing={() => setIsPricingOpen(true)}
            onStartCall={handleStartCall}
          />
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

        {/* Tab 7: Admin Compliance & KYC Queue */}
        {currentTab === 'admin-kyc' && (
          isAdmin ? (
            <AdminKYCReviewPage />
          ) : (
            <div className="py-24 text-center">
              <div className="max-w-md mx-auto p-6 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900">
                <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Admin Clearance Required</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">This compliance console is restricted to authorized platform administrators.</p>
              </div>
            </div>
          )
        )}

        {/* Tab: God Mode Admin Control Panel */}
        {currentTab === 'admin' && (
          isAdmin ? (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 -m-4 sm:-m-6 md:-m-8 p-4 md:p-8">
              <AdminControlPanel />
            </div>
          ) : (
            <div className="py-24 text-center">
              <div className="max-w-md mx-auto p-6 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900">
                <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Admin Clearance Required</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Access to platform administration is restricted to authorized personnel.</p>
              </div>
            </div>
          )
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
              privacy_policy_accepted: true,
            });
            daheejStore.updateProfile(currentProfile.id, {
              islamic_oath_signed: true,
              covenant_signed: true,
              covenant_signed_at: new Date().toISOString(),
              anti_dowry_pledged: true,
              terms_accepted: true,
              privacy_policy_accepted: true,
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

      {/* Footer */}
      {currentTab !== 'messages' && currentTab !== 'call' && (
        <Footer onNavigate={(tab) => setCurrentTab(tab)} />
      )}

      {/* Mobile Sticky Bottom Navigation (Touch-optimized for smartphones) */}
      <BottomNav
        currentTab={currentTab}
        onNavigate={(tab) => setCurrentTab(tab)}
        pendingRequestsCount={pendingRequestsCount}
        acceptedMatchesCount={acceptedMatchesCount}
        unreadMessagesCount={unreadMessagesCount}
        currentProfile={currentProfile}
        isAdmin={isAdmin}
        hideMobileNav={currentTab === 'call' || (currentTab === 'messages' && isMobileChatActive)}
        isNavigationLocked={Boolean(
          currentUserId &&
          currentProfile &&
          (!currentProfile.terms_accepted ||
            !currentProfile.privacy_policy_accepted ||
            !currentProfile.anti_dowry_pledged ||
            currentProfile.is_onboarded === false ||
            !currentProfile.avatar_url ||
            !currentProfile.profession ||
            !currentProfile.wali_name ||
            !currentProfile.wali_phone)
        )}
      />
    </div>
  );
}
