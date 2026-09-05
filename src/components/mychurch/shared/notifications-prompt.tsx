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

const PROMPT_HANDLED_KEY = 'mychurch:notifications_prompt_handled'

export function NotificationsPrompt() {
  const isAuthenticated = useAppStore((s) => s.auth.isAuthenticated)
  const [visible, setVisible] = useState(false)
  const [checking, setChecking] = useState(true)
  const [activating, setActivating] = useState(false)

  const checkSubscription = useCallback(async () => {
    if (typeof window === 'undefined') return
    // Si déjà manipulé par l'utilisateur, ne plus jamais l'embêter
    try {
      if (localStorage.getItem(PROMPT_HANDLED_KEY) === 'true') {
        setVisible(false)
        setChecking(false)
        return
      }
    } catch {}

    // Si les notifications sont déjà accordées ou refusées par le navigateur
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted' || Notification.permission === 'denied') {
        setVisible(false)
        setChecking(false)
        return
      }
    }

    const subscribed = await isSubscribed()
    setChecking(false)
    if (subscribed) {
      setVisible(false)
      return
    }
    setVisible(true)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setVisible(false)
      setChecking(true)
      return
    }
    void getOneSignal()
    const t = setTimeout(() => void checkSubscription(), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated, checkSubscription])

  async function handleAllow() {
    setActivating(true)
    // Marquer immédiatement comme géré pour éviter toute réapparition intempestive
    try { localStorage.setItem(PROMPT_HANDLED_KEY, 'true') } catch {}

    try {
      await requestPushPermission()
      toast.success('Notifications activées. Bienvenue sur MYCHURCH !')
    } catch (error) {
      const permission = await getPushPermissionState()
      if (permission === 'denied') {
        toast.info('Notifications bloquées par le navigateur. Vous pourrez les autoriser dans Paramètres.')
      } else {
        toast.info('Vous pourrez réactiver les notifications à tout moment dans Paramètres.')
      }
    } finally {
      setActivating(false)
      setVisible(false)
    }
  }

  function handleDismiss() {
    try { localStorage.setItem(PROMPT_HANDLED_KEY, 'true') } catch {}
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
              <Button size="sm" onClick={handleAllow} disabled={activating} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {activating ? 'Activation...' : 'Activer maintenant'}
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