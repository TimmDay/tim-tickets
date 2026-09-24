import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, isValidSessionToken } from '@/lib/auth';

export const config = {
  matcher: [
    // api/agent/ is called by agent workflows with a bearer token, checked in the route itself.
    // sw.js must load without a session, or registration and update checks fail after logout.
    '/((?!_next/static|_next/image|api/auth/login|api/agent/|sw\\.js$|.*\\.(?:png|ico|webmanifest|json|svg)$).*)',
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

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}
