'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { getOneSignal, setPushUser, clearPushUser } from '@/lib/onesignal-client'

// Associe l'utilisateur connecté à OneSignal pour des push ciblées.
export function onesignalLogin(userId: string) {
  void setPushUser(userId)
}

// Dissocie l'utilisateur à la déconnexion.
export function oneSignalLogout() {
  void clearPushUser()
}

export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  // Initialise le SDK une fois au démarrage (sans bloquer l'UI).
  useEffect(() => {
    void getOneSignal()
  }, [])

  // Re-lie l'External ID après rehydratation Zustand (refresh page) ou changement d'user.
  // Évite la chaîne cassée: subscribed mais pas loggé → push include_external_user_ids rate.
  const userId = useAppStore((s) => s.auth.userId)
  const isAuthenticated = useAppStore((s) => s.auth.isAuthenticated)
  useEffect(() => {
    if (isAuthenticated && userId) {
      void setPushUser(userId)
    }
  }, [isAuthenticated, userId])

  return <>{children}</>
}