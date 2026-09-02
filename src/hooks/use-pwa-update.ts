'use client'

import { useEffect, useState, useCallback } from 'react'

interface PWANotificationState {
  isUpdateAvailable: boolean
  version: string | null
  dismiss: () => void
  update: () => void
}

export function usePWAUpdate(): PWANotificationState {
  const [state, setState] = useState<PWANotificationState>({
    isUpdateAvailable: false,
    version: null,
    dismiss: () => {},
    update: () => {},
  })

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATE_AVAILABLE') {
        setState((prev) => ({
          ...prev,
          isUpdateAvailable: true,
          version: event.data.version || null,
        }))
      }
    }

    window.addEventListener('message', handleMessage)

    // Also check if there's already a waiting service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          setState((prev) => ({
            ...prev,
            isUpdateAvailable: true,
            version: null,
          }))
        }
      })
    }

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, isUpdateAvailable: false }))
  }, [])

  const update = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    }
    setState((prev) => ({ ...prev, isUpdateAvailable: false }))
  }, [])

  return { ...state, dismiss, update }
}
