---
status: accepted
---

# PWA launch performance: service worker, parallel data, lean first load

Opening tim-tickets from the iPhone home screen was slow. iOS evicts home-screen PWAs from memory quickly, so almost every launch was cold, and a cold launch waited on a serverless cold start, gRPC channel setup to Firestore, a read of every ticket ever created, and then, after hydration, two more serverless round trips for jogs and epics before the board could pick its current jog. The functions also ran in Vercel's default US region while the app is used from Melbourne.

We fix it in five independent changes, each its own commit on `perf/pwa-speedups`:

1. **Service worker (`public/sw.js`).** Cache-first for content-hashed `/_next/static/*`; stale-while-revalidate for page navigations, so the last-seen board renders instantly while a fresh copy is fetched; network-only for `/api/*`, RSC payloads, and all non-GET requests. Redirects (an expired session) and errors are never cached and evict the stale copy. Logout clears cached pages. `/sw.js` is exempt from the auth proxy and served `no-cache`. Registered only in production builds.
2. **Staleness detection (`StaleDataRefresher`).** The `(app)` layout stamps the server render time into the page. If the client finds it older than 30s (it came from the SW cache), or the PWA resumes after 5+ minutes in the background, it calls `router.refresh()` and re-fetches jogs and epics without blocking first paint.
3. **Jogs and epics server-rendered in the layout.** Next renders layouts and pages concurrently, so these reads now run in parallel with the page's ticket read instead of as a post-hydration waterfall. The providers take `initialJogs` / `initialEpics` and keep `refresh()`.
4. **Board omits archived tickets.** `getTickets({ includeArchived: false })` filters `isArchived == false` in the Firestore query, with no `orderBy` so no composite index is needed; results are sorted in memory. `JogBoard` fetches the full list only when "Show archived" is on. Other pages still read everything. Because equality filters skip docs that lack the field, unfiltered reads backfill `isArchived: false` on legacy docs, using the same self-healing pattern as the key backfill.
5. **Firestore REST transport (`preferRest: true`)**, which avoids gRPC setup on cold starts, and **functions pinned to `syd1`** via `vercel.json`.

## Considered options

- **Serwist / next-pwa.** Rejected for now. A ~100-line hand-written worker covers the three caching rules we need, with no build-plugin coupling to a Next version that is changing quickly.
- **Caching `/api/tickets` JSON in the worker.** Rejected. The page HTML already carries the ticket data, so caching it twice adds invalidation surface for no gain.
- **Network-first for navigations.** Rejected. On a weak mobile connection it is as slow as having no worker at all, which is the problem being solved.

## Consequences

- A launch can briefly show data from the previous visit (usually well under a second before the background refresh lands). Acceptable for a personal tracker; mutations always go to the network.
- `syd1` only helps if Firestore is in `australia-southeast1` or nearby. If the database lives elsewhere, the region should match the database instead, because each request makes several Firestore round trips and only one browser round trip.
- Bump `VERSION` in `sw.js` to discard every client cache on the next deploy.
- Until a page that reads all tickets (Backlog, Jogs, Epics) has been loaded once in production, any legacy ticket missing `isArchived` won't appear on the board.
