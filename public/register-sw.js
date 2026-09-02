if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for updates periodically
      setInterval(() => {
        registration.update()
      }, 60 * 1000) // Every 60 seconds

      // Listen for new service worker installing
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available, notify the app
              window.postMessage({ type: 'SW_UPDATE_AVAILABLE' }, '*')
            }
          })
        }
      })
    }).catch((e) => {
      console.warn('[PWA] SW register failed', e)
    })

    // Listen for SW messages (version update notification)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        window.postMessage({ type: 'SW_UPDATE_AVAILABLE', version: event.data.version }, '*')
      }
    })

    // When a new SW takes over, reload the page
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  })
}
