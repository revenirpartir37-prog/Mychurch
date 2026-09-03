'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldAlert, Lock, Sparkles, LayoutDashboard, Settings as SettingsIcon } from 'lucide-react'
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

  // ── CAS OÙ L'ABONNEMENT / ESSAI EST EXPIRÉ ──
  if (isExpired) {
    // 1. Onglet Dashboard : Toujours visible avec bannière d'alerte en haut
    if (currentView === 'dashboard') {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="font-bold text-sm text-foreground">
                  Abonnement expiré — Seul le Tableau de Bord est consultable
                </p>
                <p className="text-muted-foreground">
                  Vos données sont conservées en sécurité. Pour débloquer tous les autres onglets, rechargez votre abonnement.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold gap-2 text-xs shrink-0"
              onClick={() => setCurrentView('settings')}
            >
              <Sparkles className="w-3.5 h-3.5" /> Recharger dans Paramètres
            </Button>
          </div>

          <TabTipBanner />
          {children}
        </div>
      )
    }

    // 2. Onglet Paramètres : Toujours accessible pour permettre le paiement / saisie code admin
    if (currentView === 'settings') {
      return (
        <div className="space-y-4">
          <TabTipBanner />
          {children}
        </div>
      )
    }

    // 3. Tous les autres onglets : Écran élégant de verrouillage "Abonnement expiré / inactif"
    return (
      <div className="space-y-4">
        <TabTipBanner />
        <div className="min-h-[55vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-card p-6 md:p-8 text-center space-y-5 shadow-lg">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold uppercase text-[10px] tracking-wider">
                Abonnement inactif
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Abonnement expiré, veuillez recharger
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                L&apos;accès à cet onglet est temporairement restreint car votre période d&apos;essai ou votre abonnement est arrivé à expiration. Toutes les données de votre église restent précieusement conservées.
              </p>
            </div>

            <div className="pt-2 space-y-2.5">
              <Button
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 text-xs md:text-sm shadow-md"
                onClick={() => setCurrentView('settings')}
              >
                <SettingsIcon className="w-4 h-4" /> Recharger dans Paramètres → Abonnement
              </Button>

              <Button
                variant="outline"
                className="w-full text-xs gap-2"
                onClick={() => setCurrentView('dashboard')}
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Retourner au Tableau de Bord
              </Button>
            </div>
          </div>
        </div>
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
