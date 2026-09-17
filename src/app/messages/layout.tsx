'use client';

import React from 'react';

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[100dvh] w-full overflow-hidden overscroll-none fixed inset-0 flex flex-col bg-background bg-zinc-50 dark:bg-zinc-950">
      {children}
    </div>
  );
}
