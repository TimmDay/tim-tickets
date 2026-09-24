/*
 * tim-tickets service worker.
 *
 * Goal: make the home-screen PWA open instantly. iOS evicts PWAs from memory quickly, so
 * nearly every launch is a cold one that would otherwise wait on a serverless function and
 * Firestore before showing anything.
 *
 * - /_next/static/*  cache-first. Filenames are content-hashed, so a cached copy is always right.
 * - page navigations stale-while-revalidate. The last HTML seen for a page is shown at once
 *                    while a fresh copy is fetched for next time; the page itself notices it is
 *                    stale and refreshes its data (see StaleDataRefresher).
 * - everything else  straight to the network: /api/*, RSC payloads, and anything non-GET.
 *                    Ticket data is never cached apart from what is inside the page HTML.
 *
 * Bump VERSION to throw away every cache on the next activation.
 */
const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
// The `pages-` prefix is relied on by clearCachedPages() in src/lib/serviceWorker.ts (logout).
const PAGES_CACHE = `pages-${VERSION}`;
const STATIC_CACHE_MAX_ENTRIES = 200;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGES_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate' && isCacheablePage(url)) {
    event.respondWith(staleWhileRevalidate(event));
  }
  // Anything else: no respondWith, so the browser fetches it normally.
});

function isCacheablePage(url) {
  return !url.pathname.startsWith('/api/') && url.pathname !== '/login' && url.pathname !== '/sw.js';
}

/** Only a plain 200 from our own server is worth keeping. Redirects (e.g. to /login when the
 * session has expired) and errors never are. */
function isCacheable(response) {
  return response.ok && response.type === 'basic' && !response.redirected;
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    await cache.put(request, response.clone());
    trimCache(cache, STATIC_CACHE_MAX_ENTRIES);
  }
  return response;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(PAGES_CACHE);
  // Keyed by path + query without the fragment; `?jogId=` links are different pages.
  const key = new Request(new URL(request.url).href.split('#')[0]);
  const cached = await cache.match(key);

  const network = fetch(request)
    .then(async (response) => {
      if (isCacheable(response)) {
        await cache.put(key, response.clone());
      } else {
        // Logged out, or the page is gone: stop serving the old copy on the next launch.
        await cache.delete(key);
      }
      return response;
    })
    .catch(async (error) => {
      if (cached) return cached;
      throw error;
    });

  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

/** Keeps the static cache bounded; old deploys' chunks drift out oldest-first. */
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}
