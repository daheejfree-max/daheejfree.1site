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
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Handled for Server Components
        }
      },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    redirect('/login'); // OUTSIDE try/catch
  }

  const user = authData.user;
  const userEmail = user.email?.toLowerCase() || '';
  const isDesignatedSuperadmin =
    userEmail === 'behumble7860@gmail.com' ||
    userEmail === 'hasnainkhan3177@gmail.com' ||
    userEmail === 'admin@daheejfree.com';

  let isAdminFromDb = false;
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('[AdminKycLayout] Profile lookup warning:', profileError.message);
    }
    isAdminFromDb = Boolean(profile?.is_admin);
  } catch (err) {
    console.error('[AdminKycLayout] Error fetching profile:', err);
  }

  const isAdmin = Boolean(isAdminFromDb || isDesignatedSuperadmin);
  if (!isAdmin) {
    redirect('/'); // OUTSIDE try/catch
  }

  return <>{children}</>;
}
