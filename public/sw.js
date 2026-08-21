/**
 * So3ra service worker (roadmap 2.1).
 *
 * Strategy:
 * - Navigations: network-first, falling back to the cached copy of the
 *   page, then to /offline.html. Keeps data fresh while staying usable
 *   on the metro.
 * - Static assets (/_next/static, /icons): cache-first — they're
 *   content-hashed or effectively immutable.
 * - /api/* and non-GET requests are never touched; the offline diary
 *   queue handles writes (see offline-queue.ts).
 *
 * Bump VERSION to invalidate all caches on deploy of a new strategy.
 */
const VERSION = "v3";
const STATIC_CACHE = `so3ra-static-${VERSION}`;
const PAGE_CACHE = `so3ra-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll([OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? (await caches.match(OFFLINE_URL));
        })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
