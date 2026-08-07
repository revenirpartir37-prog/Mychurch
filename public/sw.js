const CACHE_NAME = 'mychurch-v2'
const urlsToCache = [
  '/',
  '/manifest.json',
  '/logo-mychurch.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  )
  self.skipWaiting()
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
  self.clients.claim()
})

// NETWORK-FIRST : on cherche le réseau en priorité pour toujours servir la
// dernière version déployée (sinon un vieux bundle en cache persistait,
// y compris l'ancien canal Realtime 'mychurch-realtime'). Le cache ne sert
// que de secours hors-ligne ou en cas d'erreur réseau.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return

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