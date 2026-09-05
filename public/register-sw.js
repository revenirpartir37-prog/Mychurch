if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for updates on window focus, NOT in a destructive 60-second loop
      window.addEventListener('focus', () => {
        registration.update().catch(() => {})
      })

      // Listen for new service worker installing
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available, notify the app banner without reloading
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

    // Ne JAMAIS recharger la page à l'improviste !
    // Le rechargement est UNIQUEMENT autorisé si l'utilisateur a cliqué pour mettre à jour.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.__PWA_MANUAL_RELOAD__) {
        window.location.reload()
      }
    })
  })
}
