'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'
import { TabTipBanner } from '../shared/tab-tip-banner'

interface SubscriptionStatus {
  isBranch: boolean
  isHeadquarters: boolean
  isExpired: boolean
  canAccess: boolean
  churchName: string
  parentName?: string
  subscription: {
    plan: string
    status: string
    endDate: string
    amount: number
  } | null
}

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { auth, currentView, setCurrentView, setIsSubscriptionExpired } = useAppStore()
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkSubscription() {
      if (!auth.token) return
      try {
        const res = await authFetch('/api/subscriptions')
        if (res.ok) {
          const data = await res.json()
          setStatus(data)
          setIsSubscriptionExpired(!!data.isExpired)
        }
      } catch (err) {
        console.error('Subscription check error:', err)
      } finally {
        setLoading(false)
      }
    }
    checkSubscription()
  }, [auth.token, setIsSubscriptionExpired])

  if (loading) {
    return (
      <div className="space-y-4">
        <TabTipBanner />
        {children}
      </div>
    )
  }

  const isExpired = !!status?.isExpired

  if (isExpired) {
    // ── ABONNEMENT EXPIRÉ : accès complet + bannière d'information ──
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200 flex items-center gap-3 shadow-sm">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <p className="text-xs flex-1">
            Votre abonnement a expiré. <Button variant="link" size="sm" className="h-auto p-0 text-xs font-bold text-amber-700 dark:text-amber-300" onClick={() => setCurrentView('settings')}>Recharger dans Paramètres</Button>
          </p>
        </div>
        <TabTipBanner />
        {children}
      </div>
    )
  }

  // ── CAS ACTIF NORMALE ──
  return (
    <div className="space-y-4">
      <TabTipBanner />
      {children}
    </div>
  )
}
