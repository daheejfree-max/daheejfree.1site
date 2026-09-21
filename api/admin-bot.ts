import { POST as webPost, GET as webGet } from '../src/app/api/admin-bot/route';

export { webPost as POST, webGet as GET };

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const webRes = await webGet();
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

      const webReq = new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(req.headers['authorization'] ? { authorization: req.headers['authorization'] } : {}),
        },
        body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
      });

      const webRes = await webPost(webReq);

      res.status(webRes.status);
      webRes.headers.forEach((val: string, key: string) => {
        res.setHeader(key, val);
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
