// ==============================================================================
// NEXT.JS SERVER COMPONENT: SECURE ADMIN DASHBOARD LAYOUT
// Protected with @supabase/ssr Session Guard & Strict is_admin Database Check
// ==============================================================================

import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import {
  Shield,
  Users,
  ShieldCheck,
  Crown,
  ArrowLeft,
  Database,
  ExternalLink,
  Lock,
  Sparkles,
  LogOut,
} from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Supabase SSR Server Client Initialization
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  let cookieStore: any;
  try {
    cookieStore = await cookies();
  } catch {
    cookieStore = null;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore?.get ? cookieStore.get(name)?.value : undefined;
      },
    },
  });

  // 2. Authenticate User Session
  let user: any = null;
  try {
    const { data: authData } = await supabase.auth.getUser();
    user = authData?.user || null;
  } catch (err) {
    console.warn('[Admin Layout Server Guard] Auth fetch warning:', err);
  }

  // Strictly block unauthenticated visitors
  if (!user) {
    redirect('/');
  }

  const userEmail = user.email?.toLowerCase() || '';

  // 3. Verify is_admin in public.profiles table
  let isAdmin = false;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, is_admin, full_name')
      .eq('id', user.id)
      .maybeSingle();

    const isDesignatedSuperadmin =
      userEmail === 'behumble7860@gmail.com' ||
      userEmail === 'hasnainkhan3177@gmail.com';

    isAdmin = Boolean(profile?.is_admin || isDesignatedSuperadmin);
  } catch (err) {
    console.error('[Admin Layout Server Guard] Profile query failed:', err);
    isAdmin = false;
  }

  // Strictly block unauthorized users who are not administrators
  if (!isAdmin) {
    console.warn(`[Admin Layout Server Guard] Access denied for non-admin user ${user.id} (${userEmail})`);
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-emerald-500 selection:text-white">
      {/* Fixed Desktop Left Sidebar */}
      <aside className="w-full md:w-64 shrink-0 bg-zinc-900/90 border-b md:border-b-0 md:border-r border-zinc-800/80 flex flex-col justify-between p-5 md:fixed md:inset-y-0 md:left-0 z-30 backdrop-blur-xl">
        {/* Top Branding & Nav */}
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-wide text-white uppercase">DaheejFree</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ADMIN
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">God Mode Console</p>
            </div>
          </div>

          {/* Admin Identity Card */}
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-emerald-400">
              {userEmail ? userEmail.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-200 truncate">{userEmail || 'Administrator'}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-zinc-400 font-medium tracking-wide">Root Privileges</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <a
              href="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800/90 text-white border border-zinc-700/60 shadow-sm transition-all"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>User Directory</span>
            </a>

            <a
              href="/admin-kyc"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
              <span>KYC Approvals</span>
            </a>

            <a
              href="/pricing"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Crown className="w-4 h-4 text-zinc-400" />
                <span>Subscription Plans</span>
              </div>
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </a>

            <div className="pt-3 border-t border-zinc-800/60 mt-3">
              <a
                href="/matches"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 border border-transparent hover:border-emerald-800/40 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Platform</span>
              </a>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer / System Badge */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-3">
          <div className="px-3 py-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60 text-[10px] space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span>RLS Bypass:</span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>Target DB:</span>
              <span className="text-zinc-300 font-mono">public.profiles</span>
            </div>
          </div>

          <a
            href="/login?logout=true"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-zinc-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Session</span>
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
              <span>Admin God Mode</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Superuser Active
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Strict User Identity Vetting, KYC Compliance & Membership Management
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Supabase Connected</span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
