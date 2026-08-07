'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Bell, BellRing, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Demande d'autorisation des notifications push à l'ouverture de l'application.
// S'affiche À CHAQUE OUVERTURE tant que l'utilisateur n'a PAS accepté (abonnement actif).
export function NotificationsPrompt() {
  const isAuthenticated = useAppStore((s) => s.auth.isAuthenticated)
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    if (typeof window === 'undefined' || !window.OneSignal) return

    // Attendre que le SDK soit chargé puis vérifier le vrai état d'abonnement.
    let mounted = true
    const check = () => {
      if (!mounted) return
      try {
        // getOnesignalId => id si abonné, undefined sinon.
        window.OneSignal?.User?.getOnesignalId?.().then((id) => {
          if (!mounted) return
          setReady(true)
          // S'affiche seulement si l'utilisateur N'EST PAS encore abonné.
          setVisible(!id)
        }).catch(() => {
          if (!mounted) return
          setReady(true)
          setVisible(true)
        })
      } catch {
        if (!mounted) return
        setReady(true)
        setVisible(true)
      }
    }

    // SDK peut ne pas être prêt au premier effet.
    const tries = [1, 5, 15]
    const timers = tries.map((t) => setTimeout(check, t * 100))
    check()

    return () => {
      mounted = false
      timers.forEach(clearTimeout)
    }
  }, [isAuthenticated])

  async function handleAllow() {
    try {
      await window.OneSignal?.Notifications?.requestPermission()
    } catch {
      // L'utilisateur a pu refuser la permission navigateur.
    }
    // On réévalue : si l'abonnement est actif, on masque pour cette session.
    window.OneSignal?.User?.getOnesignalId?.().then((id) => {
      setVisible(!id)
    }).catch(() => setVisible(false))
  }

  function handleDismiss() {
    // Simple fermeture de session : sera représenté à la prochaine ouverture tant que non accepté.
    setVisible(false)
  }

  // Ne rien rendre tant que le SDK n'a pas statué (évite un flash).
  if (!ready || !visible) return null

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
              Recevez en temps réel les nouvelles : approbations, messages et rappels d&apos;événements.
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