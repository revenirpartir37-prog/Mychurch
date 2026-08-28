if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Un seul enregistrement PWA — OneSignalSDKWorker.js est géré par le SDK OneSignal lui-même.
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => {
      console.warn('[PWA] SW register failed', e)
    })
  })
}
