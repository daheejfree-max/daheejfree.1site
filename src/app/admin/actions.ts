'use server';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Next.js Server Action for executing admin actions securely.
 * Bypasses environmental routing issues (/api/admin/action 405) by executing directly on the server.
 */
export async function executeAdminAction(
  targetUserId: string,
  action: string,
  payload: any = {}
): Promise<{ success: boolean; message?: string; profile?: any; error?: string }> {
  try {
    const cookieStore = await cookies();

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      '';
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
      return {
        success: false,
        error: 'Supabase credentials pending configuration.',
      };
    }

    // 1. Authenticate the caller session
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore?.get ? cookieStore.get(name)?.value : undefined;
          },
        },
      }
    );

    let user: any = null;
    // Authenticate via cookies first
    try {
      const { data: authData } = await supabase.auth.getUser();
      user = authData?.user;
    } catch (e) {
      console.warn('[executeAdminAction] getUser error:', e);
    }

    // If cookies were not present, cryptographically verify token from client session
    if (!user && payload?.token) {
      try {
        const { data: tokenAuth } = await supabase.auth.getUser(payload.token);
        user = tokenAuth?.user;
      } catch (e) {
        console.warn('[executeAdminAction] token auth error:', e);
      }
    }

    if (!user) {
      throw new Error('Unauthorized: No active verified user session');
    }

    const userEmail = user.email?.toLowerCase() || '';
    const isDesignatedSuperadmin =
      userEmail === 'behumble7860@gmail.com' ||
      userEmail === 'hasnainkhan3177@gmail.com' ||
      userEmail === 'admin@daheejfree.com';

    // 2. Verify caller is an admin
    let dbClient: any = supabase;

    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: profile } = await adminClient
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      const isAdmin = Boolean(profile?.is_admin || isDesignatedSuperadmin);
      if (!isAdmin) {
        throw new Error('Forbidden: Caller does not possess admin clearance');
      }

      dbClient = adminClient;
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      const isAdmin = Boolean(profile?.is_admin || isDesignatedSuperadmin);
      if (!isAdmin) {
        throw new Error('Forbidden: Caller does not possess admin clearance');
      }
    }

    // 3. Execute Mutation
    let updateData: any = { updated_at: new Date().toISOString() };
    if (action === 'verify_kyc') {
      updateData = {
        ...updateData,
        kyc_verified: true,
        kyc_status: 'verified',
        id_verified: true,
      };
    } else if (action === 'grant_subscription') {
      updateData = {
        ...updateData,
        subscription_tier: payload?.subscription_tier || payload?.tier || 'gold',
      };
    } else if (action === 'ban_user') {
      updateData = {
        ...updateData,
        is_active: false,
      };
    } else if (action === 'unban_user') {
      updateData = {
        ...updateData,
        is_active: true,
      };
    } else {
      throw new Error(`Invalid action: ${action}`);
    }

    const { data: updatedProfile, error: dbError } = await dbClient
      .from('profiles')
      .update(updateData)
      .eq('id', targetUserId)
      .select()
      .single();

    if (dbError) {
      throw new Error(dbError.message);
    }

    return {
      success: true,
      message: `Action '${action}' executed successfully.`,
      profile: updatedProfile,
    };
  } catch (error: any) {
    console.error('[executeAdminAction Error]:', error);
    return {
      success: false,
      error: error.message || 'Internal Server Error',
    };
  }
}
