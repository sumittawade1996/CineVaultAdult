// VEXN service worker. It exists so browsers treat the site as an installable app, and to show a small
// "you are offline" page instead of the browser's error screen. It deliberately caches nothing else:
// pages, scripts, posters and ads always come from the network, so a visitor can never be served a
// stale page by this file.
const CACHE = 'vexn-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  // Only page navigations: try the network, and fall back to the offline page when there is none.
  // Everything else (and every other site's requests) is left to the browser.
  if (request.mode !== 'navigate') return
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
})
