'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useEpics } from '@/lib/EpicsContext';
import { useJogs } from '@/lib/JogsContext';

/** Rendered HTML older than this is treated as stale and refreshed in the background. */
const STALE_AFTER_MS = 30_000;
/** A PWA resumed from the background after this long re-syncs too (iOS keeps the old DOM). */
const RESUME_REFRESH_AFTER_MS = 5 * 60_000;

/**
 * The service worker serves the last-seen page HTML instantly on launch (stale-while-
 * revalidate — see public/sw.js), so the board can show data from a previous visit. This
 * detects that — the server stamps the render time into the page — and quietly pulls fresh
 * tickets, jogs and epics without blocking first paint. A page that came straight from the
 * network is fresh, so it does nothing.
 */
export function StaleDataRefresher({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();
  const { refresh: refreshJogs } = useJogs();
  const { refresh: refreshEpics } = useEpics();
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const refreshAll = () => {
      router.refresh();
      refreshJogs().catch(() => {});
      refreshEpics().catch(() => {});
    };

    if (Date.now() - renderedAt > STALE_AFTER_MS) refreshAll();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current !== null && Date.now() - hiddenAt.current > RESUME_REFRESH_AFTER_MS) {
        hiddenAt.current = null;
        refreshAll();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // Run once per mount: renderedAt describes the HTML this session started from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
