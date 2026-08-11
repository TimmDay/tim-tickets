export const SESSION_COOKIE_NAME = 'tt_session';

const SESSION_PAYLOAD = 'authenticated';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function requireSessionSecret(): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) throw new Error('Missing APP_SESSION_SECRET env var');
  return secret;
}

export async function createSessionToken(): Promise<string> {
  return hmac(requireSessionSecret(), SESSION_PAYLOAD);
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await createSessionToken();
  return timingSafeEqual(token, expected);
}

export function checkPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error('Missing APP_PASSWORD env var');
  return timingSafeEqual(password, expected);
}
