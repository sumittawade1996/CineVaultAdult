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

// New-video alerts (see scripts/send-push.mjs). The message is one neutral line, so no video title ever
// appears on a lock screen; tapping it opens the "New" page (or the same-site path the message carries).
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  event.waitUntil(
    self.registration.showNotification(String(data.title || 'VEXN').slice(0, 60), {
      body: String(data.body || 'New videos were added.').slice(0, 120),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'vexn-new-videos', // a newer alert replaces an unread older one
      data: { url: typeof data.url === 'string' && /^\/[^/]/.test(data.url) ? data.url : '/new' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/new', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.navigate(target).then(() => client.focus()).catch(() => client.focus())
        }
      }
      return self.clients.openWindow(target)
    })
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  // Only page navigations: try the network, and fall back to the offline page when there is none.
  // Everything else (and every other site's requests) is left to the browser.
  if (request.mode !== 'navigate') return
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
})
