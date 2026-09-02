const CACHE_NAME = 'mychurch-v4'
const APP_VERSION = '0.3.0'
const urlsToCache = [
  '/',
  '/manifest.json',
  '/logo-mychurch.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  )
  // Don't call skipWaiting() here — let the hook decide when to activate
  // so the banner can appear before the new SW takes over.
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  // Notify all open tabs that a new version is live
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
    clients.forEach((client) =>
      client.postMessage({ type: 'SW_UPDATE_AVAILABLE', version: APP_VERSION })
    )
  })
  self.clients.claim()
})

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// NETWORK-FIRST : on cherche le réseau en priorité pour toujours servir la
// dernière version déployée (sinon un vieux bundle en cache persistait,
// y compris l'ancien canal Realtime 'mychurch-realtime'). Le cache ne sert
// que de secours hors-ligne ou en cas d'erreur réseau.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return
  // Ne jamais intercepter le SDK/worker OneSignal
  if (request.url.includes('OneSignal') || request.url.includes('onesignal.com')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        const responseToCache = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache))
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
  )
})
