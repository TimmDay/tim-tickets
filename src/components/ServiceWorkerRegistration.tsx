'use client';

import { useEffect } from 'react';

/** Registers public/sw.js in production builds. Skipped in dev, where cached pages and chunks
 * would fight hot reloading. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
  }, []);

  return null;
}
