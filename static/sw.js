/* Tensies service worker.
 *
 * Two jobs, deliberately designed so the SW can never become the thing that
 * goes stale — the classic "stuck on an old build until you delete and
 * reinstall the PWA" trap:
 *
 *   1. Cache the fingerprinted /static assets so a warm launch paints fast and
 *      a brief network blip doesn't blank the app.
 *   2. Keep the app FRESH: the HTML document is always network-first, so any
 *      boot with a connection sees the newest index — and therefore the newest
 *      hashed asset URLs. Only content-hashed /static assets are cache-first,
 *      which is safe precisely because their URL changes whenever their bytes
 *      do (a content hash in prod, a ?v=<hash> query in dev).
 *
 * BUILD is substituted server-side by the /sw.js route (main.py) with the
 * current build id, so every deploy changes this file's bytes -> the browser
 * installs a new SW -> activate() drops the previous build's caches. The PAGE
 * decides WHEN the new worker takes over: the new SW stays "waiting" until the
 * client posts 'skipWaiting' (static/js/update.js), so assets are never swapped
 * out from under a live round.
 */
const BUILD = '__BUILD_ID__';
const CACHE = `tensies-${BUILD}`;

self.addEventListener('install', () => {
  // Intentionally NOT skipWaiting(): the new worker waits until the page picks
  // a safe moment to reload (update.js), so a game in progress never has its
  // assets swapped mid-flight.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // This build owns exactly CACHE; drop every earlier build's cache.
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.startsWith('tensies-') && n !== CACHE)
        .map((n) => caches.delete(n)),
    );
    // Take control of the open page so the client's controllerchange handler
    // can drive the one post-update reload.
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  // The page asks us to take over now (player tapped "update", or they're idle
  // on a safe screen). Activating fires controllerchange -> the page reloads.
  if (event.data === 'skipWaiting') self.skipWaiting();
});

/**
 * Cache-first for a hashed static asset; populate on miss. The URL carries the
 * version, so a cache hit is always the right bytes — no revalidation needed.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const resp = await fetch(request);
  // Only whole 200 responses are cacheable: Cache.put rejects 206 (Partial
  // Content), which is how the browser streams the intro/landing videos.
  if (resp.status === 200) cache.put(request, resp.clone());
  return resp;
}

/**
 * Network-first for navigations (the HTML shell): always try the network so a
 * connected boot gets the newest document; fall back to the last-seen shell
 * only when offline.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const resp = await fetch(request);
    if (resp.status === 200) cache.put('/', resp.clone());
    return resp;
  } catch (err) {
    const cached = (await cache.match(request)) || (await cache.match('/'));
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin GETs. Skip Range requests (media streaming) so the
  // browser owns 206 partial responses end to end.
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(request));
  }
  // Everything else (API calls, /ws upgrade, /sw.js itself) falls through to
  // the network untouched.
});
