import { POST as routePost, OPTIONS as routeOptions } from '../../src/app/api/kyc/create-session/route.ts';

export { routePost as POST, routeOptions as OPTIONS };

export default async function handler(req: any, res: any) {
  if (req instanceof Request || (req && typeof req.headers?.get === 'function')) {
    if (req.method === 'OPTIONS') return routeOptions();
    return routePost(req);
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const url = `${protocol}://${host}${req.url || '/api/kyc/create-session'}`;

      let bodyData = req.body;
      if (typeof bodyData !== 'string') {
        bodyData = JSON.stringify(bodyData || {});
      }

      const webReq = new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(req.headers['authorization'] ? { authorization: req.headers['authorization'] } : {}),
        },
        body: bodyData,
      });

      const webRes = await routePost(webReq);
      const data = await webRes.json();
      return res.status(webRes.status).json(data);
    } catch (err: any) {
      console.error('[Vercel /api/kyc/create-session error]:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to create KYC session' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
