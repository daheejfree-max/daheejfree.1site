'use client';

import React from 'react';
import { ProfileGridSkeleton } from '../../../components/profiles/ProfileSkeleton';

export default function Loading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="h-20 bg-zinc-100 dark:bg-zinc-900 rounded-3xl animate-pulse" />
      <ProfileGridSkeleton count={6} />
    </div>
  );
}
