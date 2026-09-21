import { POST as webPost } from '../../src/app/api/kyc/webhook/route';

export { webPost as POST };

export default async function handler(req: any, res: any) {
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

      const webReq = new Request(url, {
        method: 'POST',
        headers,
        body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
      });

      const webRes = await webPost(webReq);
      const data = await webRes.json();
      return res.status(webRes.status).json(data);
    } catch (err: any) {
      console.error('[Vercel /api/kyc/webhook error]:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Webhook failed' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
