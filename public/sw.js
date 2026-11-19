/*
 * BattersBox offline copy. scripts/web-postbuild.mjs stamps the build id
 * below and writes precache.json (every file of the build), so a new build
 * means a new worker and a fresh copy.
 *
 * - The page itself: the saved copy, straight away. It used to wait up to 3 s
 *   for the network first, which on a phone (Tailscale still waking up, weak
 *   signal) looked like an app that wouldn't respond. A new build is fetched
 *   in the background when the app opens and takes over on the next launch.
 * - Everything else of ours: saved copy first (file names carry content hashes).
 * - /api/: always the network; sync handles being offline itself.
 */
const BUILD = '__BUILD_ID__';
const CACHE = `battersbox-${BUILD}`;
const PAGE = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const files = await (await fetch('/precache.json', { cache: 'no-store' })).json();
    await cache.addAll(files.map((f) => new Request(f, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

// Keep the previous build's copy too: a page still running the old build may
// ask for one of its own files after the new worker takes over. Anything
// older goes. (caches.keys() lists caches oldest first.)
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const ours = (await caches.keys()).filter((name) => name.startsWith('battersbox-') && name !== CACHE);
    for (const name of ours.slice(0, -1)) await caches.delete(name);
    await self.clients.claim();
  })());
});

async function page(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(PAGE);
  if (saved) return saved;
  // Not saved yet (first visit, or the copy was cleared): the network it is.
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(PAGE, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE);
  const saved = (await cache.match(request)) ?? (await caches.match(request));
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(request.mode === 'navigate' ? page(request) : asset(request));
});
