import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody = await request.text();
    let payload: any = {};

    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }

    const diditSignature = request.headers.get('x-didit-signature') || request.headers.get('x-signature');
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;

    if (webhookSecret && diditSignature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== diditSignature) {
        return Response.json({ error: 'Invalid Didit signature' }, { status: 401 });
      }
    }

    const sessionId = payload.session_id || payload.id;
    const vendorData = payload.vendor_data || payload.profile_id || payload.user_id;
    const decision = (payload.status || payload.decision || payload.event || '').toLowerCase();

    const isVerified =
      decision === 'approved' ||
      decision === 'verified' ||
      decision === 'completed' ||
      decision === 'success' ||
      payload.verification_status === 'approved';

    const kycStatus = isVerified ? 'verified' : decision.includes('reject') ? 'rejected' : 'pending';

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && (vendorData || sessionId)) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

      let query = supabaseAdmin
        .from('profiles')
        .update({
          kyc_status: kycStatus,
          updated_at: new Date().toISOString(),
        });

      if (vendorData) {
        query = query.eq('id', vendorData);
      } else if (sessionId) {
        query = query.eq('kyc_session_id', sessionId);
      }

      const { error: dbError } = await query;
      if (dbError) {
        console.error('[Didit Webhook] Supabase update error:', dbError);
      } else {
        console.info(`[Didit Webhook] Profile KYC status updated to ${kycStatus}`);
      }
    }

    return Response.json({
      success: true,
      received: true,
      sessionId,
      kycStatus,
    });
  } catch (error: any) {
    console.error('[Didit Webhook] Handler error:', error);
    return Response.json(
      { success: false, error: error?.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

export default async function handler(req: any, res: any) {
  if (req instanceof Request || (req && typeof req.headers?.get === 'function')) {
    return POST(req);
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-didit-signature, x-signature');
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const url = `${protocol}://${host}${req.url || '/api/kyc/webhook'}`;

      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (req.headers['x-didit-signature']) headers['x-didit-signature'] = req.headers['x-didit-signature'];
      if (req.headers['x-signature']) headers['x-signature'] = req.headers['x-signature'];

      let bodyData = req.body;
      if (typeof bodyData !== 'string') {
        bodyData = JSON.stringify(bodyData || {});
      }

      const webReq = new Request(url, {
        method: 'POST',
        headers,
        body: bodyData,
      });

      const webRes = await POST(webReq);
      const data = await webRes.json();
      return res.status(webRes.status).json(data);
    } catch (err: any) {
      console.error('[Vercel /api/kyc/webhook error]:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Webhook failed' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
