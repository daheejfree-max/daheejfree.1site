import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// MUST be a named export of POST
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Authenticate user
    const userClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    // Authorize admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    
    const { data: profile } = await adminClient.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Process action
    const { action, targetUserId, payload } = await req.json();
    let updateData: any = { updated_at: new Date().toISOString() };
    
    if (action === 'verify_kyc') updateData = { ...updateData, kyc_verified: true, kyc_status: 'verified', id_verified: true };
    else if (action === 'grant_subscription') updateData = { ...updateData, subscription_tier: payload?.subscription_tier || payload?.tier || 'gold' };
    else if (action === 'ban_user') updateData = { ...updateData, is_active: false };
    else if (action === 'unban_user') updateData = { ...updateData, is_active: true };
    else return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const { error } = await adminClient.from('profiles').update(updateData).eq('id', targetUserId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// OPTIONS for preflight CORS requests
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
