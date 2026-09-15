import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow all requests through; Next.js route handlers and server layouts perform specific guards
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
