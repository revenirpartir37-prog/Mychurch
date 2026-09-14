const CACHE_NAME = 'mychurch-v6'
const APP_VERSION = '0.3.1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/manifest.json', '/logo-mychurch.png'])
    )
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return
  if (request.url.includes('OneSignal') || request.url.includes('onesignal.com')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
    )
    return
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
