const CACHE_NAME = 'mychurch-v11'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/manifest.json', '/logo-mychurch.png']))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.map((n) => caches.delete(n))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => new Response('Hors ligne', { status: 503 }))
    )
    return
  }

  if (request.url.includes('/_next/') || request.url.endsWith('.js') || request.url.endsWith('.css')) {
    event.respondWith(fetch(request))
    return
  }

  if (request.url.includes('/api/') || request.url.includes('OneSignal') || request.url.includes('onesignal.com')) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => cached)
      return cached || networkFetch
    })
  )
})
