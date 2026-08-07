'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Bell, BellRing, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Charge le SDK OneSignal s'il n'est pas deja present, puis resout true quand pret.
function ensureOneSignal(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if (window.OneSignal) return resolve(true)

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) return resolve(false)

    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.async = true
    script.onload = () => {
      if (window.OneSignal?.init) {
        window.OneSignal.init({
          appId,
          notifyButton: { enable: true },
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/' },
        })
        resolve(true)
      } else {
        resolve(false)
      }
    }
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

// Demande d'autorisation des notifications push a l'ouverture de l'application.
// S'affiche a chaque ouverture tant que l'utilisateur n'a pas accepte
// (abonnement OneSignal reel).
export function NotificationsPrompt() {
  const isAuthenticated = useAppStore((s) => s.auth.isAuthenticated)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return

    let mounted = true
    // On affiche immediatement le message a chaque ouverture.
    if (mounted) setVisible(true)

    // Puis on verifie l'abonnement reel : si deja abonne, on le masque.
    void (async () => {
      const ok = await ensureOneSignal()
      if (!ok || !mounted) return
      try {
        const id = await window.OneSignal?.User?.getOnesignalId?.()
        if (id && mounted) setVisible(false)
      } catch {
        // garder visible
      }
    })()

    return () => {
      mounted = false
    }
  }, [isAuthenticated])

  async function handleAllow() {
    const ok = await ensureOneSignal()
    if (ok && window.OneSignal?.Notifications) {
      try {
        await window.OneSignal.Notifications.requestPermission()
      } catch {
        // utilisateur a pu refuser la permission navigateur
      }
    }
    // Masque pour cette session ; reviendra a la prochaine ouverture.
    setVisible(false)
  }

  function handleDismiss() {
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-sm animate-[fadeInUp_0.4s_ease-out]">
      <div className="relative rounded-xl border bg-card/95 p-4 shadow-lg shadow-primary/5 backdrop-blur">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Activer les notifications</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Recevez en temps reel les nouvelles : approbations, messages et rappels
              d&apos;evenements.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={handleAllow} className="gap-1.5">
                <BellRing className="h-3.5 w-3.5" />
                Oui, activer
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                Plus tard
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}