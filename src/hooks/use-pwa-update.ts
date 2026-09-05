'use client'

import { useEffect, useState, useCallback } from 'react'
import { APP_VERSION } from '@/lib/constants'

interface PWANotificationState {
  isUpdateAvailable: boolean
  version: string | null
  dismiss: () => void
  update: () => void
}

export function usePWAUpdate(): PWANotificationState {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)
  const [version, setVersion] = useState<string | null>(null)

  const triggerUpdate = useCallback((v?: string) => {
    setIsUpdateAvailable(true)
    setVersion(v ?? APP_VERSION)
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // 1. Listen for postMessage from the activated SW
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATE_AVAILABLE') {
        triggerUpdate(event.data.version)
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)
    window.addEventListener('message', handleMessage)

    // 2. Detect a waiting SW (already installed in background)
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        triggerUpdate()
      }

      // 3. Listen for a new SW being found after page load
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // A new SW is installed and waiting — show the banner
            triggerUpdate()
          }
        })
      })
    })

    // 4. Periodically check for SW updates (every 30 min)
    const interval = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => reg.update())
    }, 30 * 60 * 1000)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
      window.removeEventListener('message', handleMessage)
      clearInterval(interval)
    }
  }, [triggerUpdate])

  const dismiss = useCallback(() => {
    setIsUpdateAvailable(false)
  }, [])

  const update = useCallback(() => {
    setIsUpdateAvailable(false)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
          registration.update().catch(() => {})
        })
        .finally(() => {
          setTimeout(() => {
            window.location.reload()
          }, 300)
        })
    } else {
      window.location.reload()
    }
  }, [])

  return { isUpdateAvailable, version, dismiss, update }
}
