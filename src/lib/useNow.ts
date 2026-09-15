'use client';

import { useEffect, useState } from 'react';

/**
 * Current time in ms, refreshed every `intervalMs` — or null until mounted. Reading `Date.now()`
 * during render would differ between the server render and hydration; starting at null and
 * setting it in an effect keeps time-based UI (e.g. "overdue" badges) client-only.
 */
export function useNow(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [intervalMs]);
  return now;
}
