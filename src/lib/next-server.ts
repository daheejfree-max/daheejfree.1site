// Compatibility shim for next/server in Vite / Node environment
export class NextResponse extends Response {
  static json(body: any, init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  }

  static redirect(url: string | URL, status: number = 307): Response {
    return new Response(null, {
      status,
      headers: {
        Location: typeof url === 'string' ? url : url.toString(),
      },
    });
  }

  static next(): Response {
    return new Response(null, { status: 200 });
  }
}
