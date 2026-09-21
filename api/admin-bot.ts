import { POST as routePost, GET as routeGet } from '../src/app/api/admin-bot/route.ts';

export const config = {
  maxDuration: 60,
};

export { routePost as POST, routeGet as GET };

// Fallback Node.js Serverless Function handler for Vercel environments that invoke default export
export default async function handler(req: any, res: any) {
  // If invoked with Web Standard Request (e.g. Edge / Vercel Web runtime)
  if (req instanceof Request || (req && typeof req.headers?.get === 'function')) {
    if (req.method === 'GET') return routeGet();
    return routePost(req);
  }

  // If invoked with Node.js IncomingMessage / ServerResponse
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
      return res.status(500).json({ error: err?.message || 'Error checking bot status' });
    }
  }

  if (req.method === 'POST') {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const url = `${protocol}://${host}${req.url || '/api/admin-bot'}`;

      let bodyData: any = req.body;
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

      res.status(webRes.status);
      webRes.headers.forEach((val: string, key: string) => {
        // Skip hop-by-hop headers
        if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-encoding') {
          res.setHeader(key, val);
        }
      });

      if (webRes.body) {
        const reader = webRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        return res.end();
      } else {
        const text = await webRes.text();
        return res.send(text);
      }
    } catch (err: any) {
      console.error('[Vercel /api/admin-bot error]:', err);
      return res.status(500).json({ error: err?.message || 'Internal server error in admin bot' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
