import React from 'react';
import {
  Compass,
  UserCheck,
  HeartHandshake,
  MessageSquare,
  User,
  Shield,
} from 'lucide-react';
import { Profile } from '../../types/database';

interface BottomNavProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  pendingRequestsCount?: number;
  acceptedMatchesCount?: number;
  unreadMessagesCount?: number;
  currentProfile: Profile | null;
  isAdmin?: boolean;
  hideMobileNav?: boolean;
  isNavigationLocked?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onNavigate,
  pendingRequestsCount = 0,
  acceptedMatchesCount = 0,
  unreadMessagesCount = 0,
  currentProfile,
  isAdmin = false,
  hideMobileNav = false,
  isNavigationLocked = false,
}) => {
  // Do not render bottom navigation for unauthenticated guests, or in full-screen call room, or when hidden
  if (!currentProfile || currentTab === 'call' || hideMobileNav || isNavigationLocked) {
    return null;
  }

  const navItems = [
    {
      id: 'matches',
      label: 'Discover',
      icon: Compass,
      isActive: currentTab === 'matches',
      badge: 0,
    },
    {
      id: 'requests',
      label: 'Requests',
      icon: UserCheck,
      isActive: currentTab === 'requests',
      badge: pendingRequestsCount,
      badgeColor: 'bg-rose-600',
    },
    {
      id: 'my-matches',
      label: 'Matches',
      icon: HeartHandshake,
      isActive: currentTab === 'my-matches' || currentTab === 'accepted',
      badge: acceptedMatchesCount,
      badgeColor: 'bg-emerald-600',
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      isActive: currentTab === 'messages',
      badge: unreadMessagesCount,
      badgeColor: 'bg-emerald-500',
      pulse: unreadMessagesCount > 0,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      isActive: currentTab === 'profile' || currentTab === 'kyc-pending',
      badge: 0,
    },
  ];

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200/90 dark:border-zinc-800/90 px-2 py-1 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] transition-colors"
    >
      <div className={`grid ${isAdmin ? 'grid-cols-6' : 'grid-cols-5'} items-center max-w-lg mx-auto h-14`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={`bottom-nav-${item.id}`}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`relative flex flex-col items-center justify-center min-h-[44px] w-full px-0.5 sm:px-1 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 touch-manipulation select-none ${
                item.isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    item.isActive ? 'stroke-[2.5px]' : 'stroke-2'
                  }`}
                />
                {item.badge > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full text-[10px] font-extrabold text-white flex items-center justify-center ${
                      item.badgeColor || 'bg-rose-600'
                    } ${item.pulse ? 'animate-pulse' : ''}`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full font-medium">
                {item.label}
              </span>
              {item.isActive && (
                <span className="w-1 h-1 rounded-full bg-emerald-500 dark:bg-emerald-400 mt-0.5" />
              )}
            </button>
          );
        })}

        {/* Small Admin Quick Access icon ONLY if user is verified admin */}
        {isAdmin && (
          <button
            id="bottom-nav-admin"
            type="button"
            onClick={() => onNavigate('admin')}
            title="Admin Console"
            className={`relative flex flex-col items-center justify-center min-h-[44px] w-full px-0.5 sm:px-1 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 touch-manipulation select-none ${
              currentTab === 'admin'
                ? 'text-emerald-500 font-bold'
                : 'text-zinc-400 hover:text-emerald-400'
            }`}
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-[9px] mt-0.5 font-semibold text-emerald-500/90 truncate max-w-full">Admin</span>
          </button>
        )}
      </div>
    </nav>
  );
};
