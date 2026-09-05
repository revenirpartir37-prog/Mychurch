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

  const isHandled = useCallback(() => {
    if (typeof window === 'undefined') return true
    try {
      return sessionStorage.getItem('pwa_update_handled') === APP_VERSION
    } catch {
      return false
    }
  }, [])

  const triggerUpdate = useCallback((v?: string) => {
    if (isHandled()) return
    setIsUpdateAvailable(true)
    setVersion(v ?? APP_VERSION)
  }, [isHandled])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (isHandled()) return

    navigator.serviceWorker.ready.then((registration) => {
      // Détecter si un nouveau SW est déjà en attente
      if (registration.waiting && navigator.serviceWorker.controller) {
        triggerUpdate()
      }

      // Écouter l'arrivée d'un nouveau SW
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            triggerUpdate()
          }
        })
      })
    })
  }, [triggerUpdate, isHandled])

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem('pwa_update_handled', APP_VERSION)
    } catch {}
    setIsUpdateAvailable(false)
  }, [])

  const update = useCallback(() => {
    try {
      sessionStorage.setItem('pwa_update_handled', APP_VERSION)
    } catch {}
    setIsUpdateAvailable(false)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
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
