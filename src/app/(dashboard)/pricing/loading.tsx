'use client';

import React from 'react';

export default function PricingLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 space-y-12 animate-pulse max-w-7xl mx-auto">
      <div className="max-w-4xl mx-auto text-center space-y-4">
        <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl mx-auto" />
        <div className="h-12 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-2xl mx-auto" />
        <div className="h-6 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded-lg mx-auto" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-96 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
