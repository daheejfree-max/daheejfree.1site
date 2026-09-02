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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/90 rounded-3xl overflow-hidden shadow-sm dark:shadow-lg flex flex-col justify-between animate-pulse">
      {/* Top Badges Skeleton */}
      <div className="p-5 pb-0 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* KYC badge placeholder */}
          <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
          {/* Zero dowry pill placeholder */}
          <div className="h-6 w-20 bg-zinc-200/80 dark:bg-zinc-800/80 rounded-full" />
        </div>
        {/* Tier badge placeholder */}
        <div className="h-5 w-14 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>

      {/* Main Avatar Section */}
      <div className="p-5 flex flex-col items-center text-center">
        {/* Avatar Box Placeholder */}
        <div className="w-28 h-28 rounded-2xl mb-4 bg-zinc-200 dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-700/60 flex items-center justify-center relative overflow-hidden">
          <div className="w-10 h-10 rounded-full bg-zinc-300 dark:bg-zinc-700/60" />
        </div>

        {/* Full Name Placeholder */}
        <div className="h-5 w-36 bg-zinc-200 dark:bg-zinc-800 rounded-md mb-2" />
        {/* Demographics / Age / Bride-Groom Placeholder */}
        <div className="h-3.5 w-28 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-md mb-3" />

        {/* Consent Action Button Placeholder */}
        <div className="h-7 w-40 bg-zinc-200/90 dark:bg-zinc-800/90 rounded-lg mb-4" />

        {/* Bio & Details Skeleton */}
        <div className="w-full text-left pt-4 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
          {/* Profession */}
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
            <div className="h-3.5 w-3/4 bg-zinc-200/80 dark:bg-zinc-800/80 rounded" />
          </div>
          {/* Location */}
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
            <div className="h-3.5 w-1/2 bg-zinc-200/80 dark:bg-zinc-800/80 rounded" />
          </div>
          {/* Education */}
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
            <div className="h-3.5 w-2/3 bg-zinc-200/80 dark:bg-zinc-800/80 rounded" />
          </div>

          {/* Bio Quote Lines */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/40 space-y-1.5">
            <div className="h-3 w-full bg-zinc-200/60 dark:bg-zinc-800/60 rounded" />
            <div className="h-3 w-4/5 bg-zinc-200/60 dark:bg-zinc-800/60 rounded" />
          </div>
        </div>
      </div>

      {/* Sensitive Wali Gating Section Skeleton */}
      <div className="p-4 bg-zinc-50 dark:bg-zinc-950/80 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-3.5 w-24 bg-zinc-200/70 dark:bg-zinc-800/70 rounded" />
        </div>

        {/* Wali Access Button */}
        <div className="h-9 w-full bg-zinc-200 dark:bg-zinc-800 rounded-lg" />

        {/* Chat & Call Buttons */}
        <div className="space-y-2 mt-1">
          <div className="h-8 w-full bg-zinc-200/90 dark:bg-zinc-800/90 rounded-lg" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-8 bg-zinc-200/80 dark:bg-zinc-800/80 rounded-lg" />
            <div className="h-8 bg-zinc-200/80 dark:bg-zinc-800/80 rounded-lg" />
          </div>
        </div>
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
