// ==============================================================================
// NEXT.JS SERVER RUNTIME SHIM
// File: src/lib/nextServer.ts
// Provides standard NextResponse compatible with Next.js App Router and Vite/Express
// ==============================================================================

export class NextResponse extends Response {
  static json(body: any, init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      statusText: init?.statusText,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  }
}
