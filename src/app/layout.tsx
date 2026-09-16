'use client';

import React, { useEffect, useState } from 'react';
import { ThemeProvider } from '../context/ThemeContext';
import { GlobalCallPopup } from '../components/GlobalCallPopup';
import { GlobalNotificationListener } from '../components/notifications/GlobalNotificationListener';
import { supabase } from '../lib/supabase/client';
import { daheejStore } from '../lib/supabase/store';
import '../index.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        setCurrentUserId(data.user.id);
      } else {
        const localId = daheejStore.getCurrentUserId();
        if (localId) setCurrentUserId(localId);
      }
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        setCurrentUserId(session.user.id);
      } else {
        const localId = daheejStore.getCurrentUserId();
        setCurrentUserId(localId || '');
      }
    });

    return () => {
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body className="min-h-screen w-full overflow-x-hidden bg-zinc-950 text-zinc-50 antialiased font-sans transition-colors duration-200">
        <ThemeProvider>
          {/* Global Realtime Incoming Call Popup (High Priority Fullscreen Interruption) */}
          <GlobalCallPopup />

          {/* Global Realtime Notification & Message Toast Alerts */}
          <GlobalNotificationListener currentUserId={currentUserId} />
          
          <main className="min-h-screen w-full overflow-x-hidden">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
