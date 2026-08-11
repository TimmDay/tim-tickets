import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, isValidSessionToken } from '@/lib/auth';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/login).*)'],
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
