'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import {
  getOneSignal,
  requestPushPermission,
  isSubscribed,
  getPushPermissionState,
} from '@/lib/onesignal-client'
import { toast } from 'sonner'
import { Bell, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Demande d'autorisation des notifications push à la première connexion / inscription.
// S'affiche à chaque ouverture tant que l'utilisateur n'a pas accepté (abonnement actif).
export function NotificationsPrompt() {
  const isAuthenticated = useAppStore((s) => s.auth.isAuthenticated)
  const [visible, setVisible] = useState(false)
  const [checking, setChecking] = useState(true)

  const checkSubscription = useCallback(async () => {
    const subscribed = await isSubscribed()
    setChecking(false)
    setVisible(!subscribed)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setVisible(false)
      setChecking(true)
      return
    }
    // Préchauffe le SDK puis vérifie l'abonnement réel.
    void getOneSignal()
    const t = setTimeout(() => void checkSubscription(), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated, checkSubscription])

  async function handleAllow() {
    try {
      await requestPushPermission()
      toast.success('Notifications activées. Bienvenue sur MYCHURCH !')
      setVisible(false)
    } catch (error) {
      const permission = await getPushPermissionState()
      if (permission === 'denied') {
        toast.error('Notifications bloquées. Activez-les dans les paramètres du navigateur.')
      } else {
        toast.error(error instanceof Error ? error.message : 'Impossible d’activer les notifications')
      }
      const subscribed = await isSubscribed()
      setVisible(!subscribed)
    }
  }

  function handleDismiss() {
    setVisible(false)
  }

  // Ne rien rendre tant qu'on n'a pas vérifié (évite flash), ni si connecté.
  if (checking || !isAuthenticated || !visible) return null

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
              Pour votre première connexion : recevez en temps réel approbations, messages et
              rappels d&apos;événements.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleAllow} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Activer maintenant
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