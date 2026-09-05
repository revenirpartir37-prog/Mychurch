const CACHE_NAME = 'mychurch-v5'
const APP_VERSION = '0.3.0'
const urlsToCache = [
  '/manifest.json',
  '/logo-mychurch.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  )
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
})

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// NETWORK-FIRST pour les assets, et NETWORK-ONLY pour la navigation HTML
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return
  // Ne jamais intercepter le SDK/worker OneSignal
  if (request.url.includes('OneSignal') || request.url.includes('onesignal.com')) return

  // Les requêtes de navigation (HTML des pages) vont directement au réseau pour garantir la version fraîche
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/manifest.json').then(() => new Response('Hors ligne', { status: 503 })))
    )
    return
  }

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
      .catch(() => caches.match(request))
  )
})
