import { POST as routePost, GET as routeGet, OPTIONS as routeOptions } from '../../src/app/api/admin/action/route.ts';

export { routePost as POST, routeGet as GET, routeOptions as OPTIONS };

export default async function handler(req: any, res: any) {
  if (req instanceof Request || (req && typeof req.headers?.get === 'function')) {
    if (req.method === 'OPTIONS') return routeOptions();
    if (req.method === 'GET') return routeGet();
    return routePost(req);
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const webRes = await routeGet();
      const data = await webRes.json();
      return res.status(webRes.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Error checking admin API' });
    }
  }

  if (req.method === 'POST') {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const url = `${protocol}://${host}${req.url || '/api/admin/action'}`;

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
      console.error('[Vercel /api/admin/action error]:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Admin action failed' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
