'use client'

import { useEffect } from 'react'
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

  return <>{children}</>
}