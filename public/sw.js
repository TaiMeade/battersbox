/*
 * BattersBox offline copy. scripts/web-postbuild.mjs stamps the build id
 * below and writes precache.json (every file of the build), so a new build
 * means a new worker, a fresh copy, and the old one deleted.
 *
 * - The page itself: network first (3 s), the saved copy when there's no signal.
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

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('battersbox-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 3000)),
    ]);
    if (response.ok) await cache.put(PAGE, response.clone());
    return response;
  } catch {
    return (await cache.match(PAGE)) ?? Response.error();
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
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
