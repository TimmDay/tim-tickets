import { NextResponse } from 'next/server';
import { checkPassword, createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { clearLoginAttempts, isLoginRateLimited, recordFailedLogin } from '@/lib/firestore';

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  if (await isLoginRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = body?.password;

  if (typeof password !== 'string' || !checkPassword(password)) {
    await recordFailedLogin(ip);
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  await clearLoginAttempts(ip);

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
