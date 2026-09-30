'use client';

// ==============================================================================
// RESPONSIVE HYBRID USER PROFILE MENU (src/components/layout/UserMenu.tsx)
// Desktop: Absolute dropdown panel (md:absolute md:top-full md:right-0 md:w-64)
// Mobile: Full-screen fixed modal (fixed inset-0 z-[100] w-full h-[100dvh])
// ==============================================================================

import React, { useEffect, useRef } from 'react';
import { useRouter } from '../../lib/navigation';
import {
  User,
  Crown,
  Sparkles,
  Lock,
  PhoneCall,
  CreditCard,
  Shield,
  LogIn,
  LogOut,
  CheckCircle,
  X,
} from 'lucide-react';
import { Profile, SubscriptionTier } from '../../types';
import { Logo } from '../brand/Logo';
import { supabase } from '../../lib/supabase/client';
import { signOutSupabase } from '../../lib/supabase/auth';
import { daheejStore } from '../../lib/supabase/store';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

export interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: Profile;
  tier: SubscriptionTier;
  isAdmin?: boolean;
  pendingConsentCount?: number;
  onNavigate: (tab: string) => void;
  onOpenPricing: () => void;
  onOpenLogin?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  isOpen,
  onClose,
  currentProfile,
  tier,
  isAdmin = false,
  pendingConsentCount = 0,
  onNavigate,
  onOpenPricing,
  onOpenLogin,
}) => {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Z-Index and Isolation: Lock background scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Click outside listener for desktop view
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        window.innerWidth >= 768 &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getTierBadge = (t: SubscriptionTier) => {
    switch (t) {
      case 'diamond':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 shadow-xs">
            <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Diamond Tier
          </span>
        );
      case 'platinum':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Platinum Tier
          </span>
        );
      case 'gold':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Gold Tier
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

  return (
    <div
      ref={menuRef}
      id="user-profile-menu-container"
      role="dialog"
      aria-modal="true"
      aria-label="User Profile Menu"
      className="fixed inset-0 z-[100] w-full h-[100dvh] flex flex-col bg-white dark:bg-zinc-950 md:absolute md:inset-auto md:top-full md:mt-2 md:right-0 md:w-64 md:h-auto md:rounded-xl md:shadow-xl md:border md:border-zinc-200 md:dark:border-zinc-800 md:bg-white md:dark:bg-zinc-900 md:z-50 md:block animate-in fade-in duration-150"
    >
      {/* 2. Mobile Header & Close Button (ONLY on mobile: flex md:hidden) */}
      <div className="flex md:hidden items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Logo
            size="sm"
            showSubtitle={false}
            onClick={() => {
              onNavigate('matches');
              onClose();
            }}
          />
        </div>
        <button
          type="button"
          id="btn-close-profile-menu"
          onClick={onClose}
          aria-label="Close profile menu"
          className="p-2 -mr-2 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* 3. Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-2 space-y-1">
        {/* User Identity & KYC Overview Card */}
        <div className="p-3 mb-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 md:border-0 md:border-b md:border-zinc-200 md:dark:border-zinc-800 md:rounded-none md:bg-transparent md:p-2 md:mb-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 md:w-9 md:h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 overflow-hidden flex items-center justify-center text-emerald-800 dark:text-emerald-300 font-bold text-sm shrink-0">
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
              <p className="text-sm md:text-xs font-bold text-zinc-900 dark:text-white truncate">
                {currentProfile.full_name}
              </p>
              <p className="text-xs md:text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {currentProfile.wali_email || 'Verified Account'}
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            {getTierBadge(tier)}
            {currentProfile.kyc_verified === true && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
        </div>

        {/* Primary Navigation Links with Massive Touch Targets (w-full block py-3 md:py-2 px-4 rounded-lg) */}
        <div className="space-y-1">
          {/* 1. My Profile & KYC Status */}
          <button
            type="button"
            id="profile-menu-item-profile"
            onClick={() => {
              onClose();
              onNavigate('profile');
            }}
            className="w-full flex items-center gap-3 py-3 md:py-2 px-4 rounded-lg text-left text-sm md:text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <User className="w-5 h-5 md:w-4 md:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>My Profile & KYC Status</span>
          </button>

          {/* 2. Photo Privacy Gating */}
          <button
            type="button"
            id="profile-menu-item-consent"
            onClick={() => {
              onClose();
              onNavigate('consent');
            }}
            className="w-full flex items-center justify-between py-3 md:py-2 px-4 rounded-lg text-left text-sm md:text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 md:w-4 md:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Photo Privacy Gating</span>
            </div>
            {pendingConsentCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs md:text-[10px] font-bold">
                {pendingConsentCount}
              </span>
            )}
          </button>

          {/* 3. WebRTC Video Calling */}
          <button
            type="button"
            id="profile-menu-item-calls"
            onClick={() => {
              onClose();
              onNavigate('calls');
            }}
            className="w-full flex items-center gap-3 py-3 md:py-2 px-4 rounded-lg text-left text-sm md:text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <PhoneCall className="w-5 h-5 md:w-4 md:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>WebRTC Video Calling</span>
          </button>

          {/* 4. Upgrade Membership Plans */}
          <button
            type="button"
            id="profile-menu-item-pricing"
            onClick={() => {
              onClose();
              onOpenPricing();
            }}
            className="w-full flex items-center justify-between py-3 md:py-2 px-4 rounded-lg text-left text-sm md:text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 md:w-4 md:h-4 text-amber-500 shrink-0" />
              <span>Upgrade / Manage Membership</span>
            </div>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 hidden sm:inline">
              {tier === 'diamond' ? 'Diamond' : 'Plans'}
            </span>
          </button>

          {/* 5. Anti-Dowry Registry Certificate */}
          <button
            type="button"
            id="profile-menu-item-pledge"
            onClick={() => {
              onClose();
              onNavigate('pledge');
            }}
            className="w-full flex items-center gap-3 py-3 md:py-2 px-4 rounded-lg text-left text-sm md:text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Shield className="w-5 h-5 md:w-4 md:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Anti-Dowry Registry Certificate</span>
          </button>
        </div>

        {/* PWA Application Install Option */}
        <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800">
          <PWAInstallButton variant="menu" onInstalled={onClose} />
        </div>

        {/* Admin God Mode (Strictly guarded by database verified status) */}
        {isAdmin && (
          <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              id="profile-menu-item-admin"
              onClick={() => {
                onClose();
                onNavigate('admin');
              }}
              className="w-full flex items-center gap-3 py-3 md:py-2 px-4 rounded-lg text-left text-sm md:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
            >
              <Shield className="w-5 h-5 md:w-4 md:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Admin God Mode</span>
            </button>
          </div>
        )}

        {/* Authentication Options (Switch Account & Sign Out) */}
        <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
          <button
            type="button"
            id="profile-menu-item-signin-other"
            onClick={async () => {
              onClose();
              try {
                await supabase.auth.signOut();
                daheejStore.setCurrentUserId(null);
              } catch (err) {
                console.warn('[UserMenu] Sign out notice:', err);
              }
              if (onOpenLogin) onOpenLogin();
              try {
                router.push('/login');
              } catch {
                if (typeof window !== 'undefined') {
                  window.location.href = '/login';
                }
              }
            }}
            className="w-full flex items-center gap-3 py-3 md:py-2 px-4 rounded-lg text-left text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <LogIn className="w-5 h-5 md:w-4 md:h-4 text-zinc-500 shrink-0" />
            <span>Sign In with Another Account</span>
          </button>

          <button
            type="button"
            id="profile-menu-item-signout"
            onClick={async () => {
              onClose();
              await signOutSupabase({ hardRedirect: true });
            }}
            className="w-full flex items-center gap-3 py-3 md:py-2 px-4 rounded-lg text-left text-sm md:text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5 md:w-4 md:h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
