import { FieldValue } from '@google-cloud/firestore';
import { FirestoreLike } from './client';

const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function loginAttemptsDocId(ip: string): string {
  return encodeURIComponent(ip);
}

export function createLoginAttemptsRepo(db: FirestoreLike) {
  const loginAttemptsCollection = () => db.collection('loginAttempts');

  async function isLoginRateLimited(ip: string): Promise<boolean> {
    const doc = await loginAttemptsCollection().doc(loginAttemptsDocId(ip)).get();
    if (!doc.exists) return false;
    const data = doc.data()!;
    const windowAge = Date.now() - new Date(data.windowStart as string).getTime();
    if (windowAge > LOGIN_RATE_LIMIT_WINDOW_MS) return false;
    return (data.count as number) >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  }

  async function recordFailedLogin(ip: string): Promise<void> {
    const ref = loginAttemptsCollection().doc(loginAttemptsDocId(ip));
    const doc = await ref.get();
    const now = new Date().toISOString();

    if (!doc.exists) {
      await ref.set({ count: 1, windowStart: now });
      return;
    }

    const data = doc.data()!;
    const windowAge = Date.now() - new Date(data.windowStart as string).getTime();
    if (windowAge > LOGIN_RATE_LIMIT_WINDOW_MS) {
      await ref.set({ count: 1, windowStart: now });
    } else {
      await ref.update({ count: FieldValue.increment(1) });
    }
  }

  async function clearLoginAttempts(ip: string): Promise<void> {
    await loginAttemptsCollection().doc(loginAttemptsDocId(ip)).delete();
  }

  return { isLoginRateLimited, recordFailedLogin, clearLoginAttempts };
}

export type LoginAttemptsRepo = ReturnType<typeof createLoginAttemptsRepo>;
