'use server';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Next.js Server Action for executing admin actions securely.
 * Authenticates caller via cookies / token, verifies admin clearance,
 * and performs mutations strictly using the elevated Supabase Service Role client.
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

    // 1. Authenticate the caller session with full cookie forwarding
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
            // Handled if invoked in context where cookie setting is constrained
          }
        },
      },
    });

    let user: any = null;
    // Authenticate via forwarded cookies first
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (!authErr && authData?.user) {
        user = authData.user;
      }
    } catch (e) {
      console.warn('[executeAdminAction] getUser error:', e);
    }

    // Cryptographically verify token from client session if cookie session was missing
    if (!user && payload?.token) {
      try {
        const { data: tokenAuth, error: tokenErr } = await supabase.auth.getUser(payload.token);
        if (!tokenErr && tokenAuth?.user) {
          user = tokenAuth.user;
        }
      } catch (e) {
        console.warn('[executeAdminAction] token auth error:', e);
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'Unauthorized: No active verified user session found.',
      };
    }

    const userEmail = user.email?.toLowerCase() || '';
    const isDesignatedSuperadmin =
      userEmail === 'behumble7860@gmail.com' ||
      userEmail === 'hasnainkhan3177@gmail.com' ||
      userEmail === 'admin@daheejfree.com';

    // 2. Verify caller possesses admin status
    // Use service role client if available to bypass RLS during admin verification
    if (!serviceRoleKey) {
      console.error('[executeAdminAction] Missing SUPABASE_SERVICE_ROLE_KEY');
      return {
        success: false,
        error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is required for admin mutations.',
      };
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('[executeAdminAction] Profile lookup notice:', profileErr.message);
    }

    const isAdmin = Boolean(profile?.is_admin || isDesignatedSuperadmin);
    if (!isAdmin) {
      return {
        success: false,
        error: 'Forbidden: Caller does not possess admin clearance.',
      };
    }

    // 3. Execute Mutation via elevated Service Role Client (strictly bypassing RLS)
    let updateData: any = { updated_at: new Date().toISOString() };
    if (action === 'verify_kyc') {
      updateData = {
        ...updateData,
        kyc_verified: true,
        kyc_status: 'verified',
        id_verified: true,
        is_verified: true,
      };
    } else if (action === 'unverify_kyc' || action === 'unverify') {
      updateData = {
        ...updateData,
        kyc_verified: false,
        kyc_status: 'pending',
        id_verified: false,
        is_verified: false,
      };
    } else if (action === 'grant_subscription') {
      updateData = {
        ...updateData,
        subscription_tier: payload?.subscription_tier || payload?.tier || 'gold',
        membership_tier: payload?.subscription_tier || payload?.tier || 'gold',
      };
    } else if (action === 'set_free' || action === 'set_free_subscription') {
      updateData = {
        ...updateData,
        subscription_tier: 'free',
        membership_tier: 'free',
        subscription_status: 'inactive',
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
      return {
        success: false,
        error: `Invalid admin action requested: ${action}`,
      };
    }

    const { data: updatedProfile, error: dbError } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', targetUserId)
      .select()
      .maybeSingle();

    if (dbError) {
      console.error('[executeAdminAction Mutation Error]:', dbError);
      return {
        success: false,
        error: `Database mutation failed: ${dbError.message}`,
      };
    }

    if (!updatedProfile) {
      return {
        success: false,
        error: `Target user profile ${targetUserId} not found or update returned no rows.`,
      };
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
