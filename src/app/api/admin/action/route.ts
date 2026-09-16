import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET() {
  return NextResponse.json({ status: 'Admin API Active' });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '').trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server misconfiguration: missing Supabase credentials' }, { status: 500 });
    }

    // Authenticate caller
    const userClient = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Authorize admin clearance with elevated service role client
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    
    const userEmail = user.email?.toLowerCase() || '';
    const isDesignatedSuperadmin =
      userEmail === 'behumble7860@gmail.com' ||
      userEmail === 'hasnainkhan3177@gmail.com' ||
      userEmail === 'admin@daheejfree.com';

    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('[api/admin/action] Admin verification notice:', profileErr.message);
    }

    const isAdmin = Boolean(profile?.is_admin || isDesignatedSuperadmin);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin clearance required' }, { status: 403 });
    }

    // Process database mutations
    const { action, targetUserId, payload } = await req.json();
    let updateData: any = { updated_at: new Date().toISOString() };
    
    if (action === 'verify_kyc') {
      updateData = { ...updateData, kyc_verified: true, kyc_status: 'verified', id_verified: true };
    } else if (action === 'grant_subscription') {
      updateData = { ...updateData, subscription_tier: payload?.subscription_tier || payload?.tier || 'gold' };
    } else if (action === 'ban_user') {
      updateData = { ...updateData, is_active: false };
    } else if (action === 'unban_user') {
      updateData = { ...updateData, is_active: true };
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data: updatedProfile, error: dbErr } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', targetUserId)
      .select()
      .maybeSingle();

    if (dbErr) {
      console.error('[api/admin/action] Mutation DB error:', dbErr);
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    if (!updatedProfile) {
      return NextResponse.json({ error: `User profile with ID ${targetUserId} not found` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Action '${action}' executed successfully.`,
      profile: updatedProfile,
    });
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
