'use client';

// ==============================================================================
// PROFILE CARD SKELETON COMPONENT (LOADING PLACEHOLDER)
// ==============================================================================

import React from 'react';

interface ProfileSkeletonProps {
  count?: number;
}

export const ProfileSkeletonCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm p-5 flex flex-col animate-pulse">
      {/* Top Badges Skeleton */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-5 w-20 bg-zinc-200/80 dark:bg-zinc-800/80 rounded-md" />
        </div>
        <div className="h-5 w-14 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-md" />
      </div>

      {/* Main Full-width Image Area */}
      <div className="w-full aspect-square rounded-xl bg-zinc-200 dark:bg-zinc-800" />

      {/* Name & Demographics Skeleton */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-6 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-4 w-12 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-md" />
        </div>
        <div className="h-4 w-32 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-md" />
      </div>

      {/* Highlights Skeleton */}
      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
        <div className="h-3.5 w-3/4 bg-zinc-200/80 dark:bg-zinc-800/80 rounded" />
        <div className="h-3.5 w-1/2 bg-zinc-200/80 dark:bg-zinc-800/80 rounded" />
      </div>

      {/* Action Button Skeleton */}
      <div className="mt-6 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="h-11 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    </div>
  );
};

export const ProfileGridSkeleton: React.FC<ProfileSkeletonProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="profiles-grid-skeleton">
      {Array.from({ length: count }).map((_, idx) => (
        <ProfileSkeletonCard key={`profile-skeleton-${idx}`} />
      ))}
    </div>
  );
};
