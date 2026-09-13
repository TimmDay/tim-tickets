import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, isValidSessionToken } from '@/lib/auth';

export const config = {
  matcher: [
    // api/agent/ is called by agent workflows with a bearer token, checked in the route itself.
    '/((?!_next/static|_next/image|api/auth/login|api/agent/|.*\\.(?:png|ico|webmanifest|json|svg)$).*)',
  ],
};

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (await isValidSessionToken(token)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', request.url));
}
