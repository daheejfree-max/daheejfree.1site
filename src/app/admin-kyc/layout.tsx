import React from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function AdminKycLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore?.get ? cookieStore.get(name)?.value : undefined;
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login'); // OUTSIDE try/catch

  const userEmail = user.email?.toLowerCase() || '';
  const isDesignatedSuperadmin =
    userEmail === 'behumble7860@gmail.com' ||
    userEmail === 'hasnainkhan3177@gmail.com' ||
    userEmail === 'admin@daheejfree.com';

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  const isAdmin = Boolean(profile?.is_admin || isDesignatedSuperadmin);
  if (!isAdmin) redirect('/'); // OUTSIDE try/catch

  return <>{children}</>;
}
