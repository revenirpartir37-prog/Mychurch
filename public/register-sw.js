if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const reg of registrations) {
        if (reg.active && !reg.active.scriptURL.includes('/sw.js')) {
          await reg.unregister()
        }
      }
    } catch {}

    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.warn('[PWA] SW register failed', e)
    })
  })
}
