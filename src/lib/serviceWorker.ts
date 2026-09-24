/** Deletes the service worker's cached page HTML (see public/sw.js), e.g. on logout, so the
 * PWA can't reopen to a board from the previous session. Safe to call anywhere. */
export async function clearCachedPages(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('pages-')).map((name) => caches.delete(name)));
  } catch {
    // Cache storage can be unavailable (e.g. some private modes); nothing to clear then.
  }
}
