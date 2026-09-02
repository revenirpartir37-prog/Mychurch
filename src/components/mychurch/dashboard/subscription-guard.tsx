'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { ShieldAlert, RefreshCw, LogOut, CheckCircle2, Lock, ArrowRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { APP_VERSION, CREATOR } from '@/lib/constants'

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
  const { auth, logout } = useAppStore()
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paying, setPaying] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | 'annual_branch'>('annual')

  useEffect(() => {
    async function checkSubscription() {
      if (!auth.token) return
      try {
        const res = await authFetch('/api/subscriptions')
        if (res.ok) {
          const data = await res.json()
          setStatus(data)
          if (data.isBranch) {
            setSelectedPlan('annual_branch')
          }
        }
      } catch (err) {
        console.error('Subscription check error:', err)
      } finally {
        setLoading(false)
      }
    }
    checkSubscription()
  }, [auth.token])

  const handlePay = async (planToPay: 'monthly' | 'annual' | 'annual_branch') => {
    setPaying(true)
    try {
      const res = await authFetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planToPay }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl
        } else {
          toast.success('Paiement initié')
        }
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors du paiement')
      }
    } catch {
      toast.error('Erreur de connexion au service de paiement')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return <>{children}</>
  }

  // 1. CAS STRICT : Église Affiliée avec abonnement expiré -> Accès restreint et interdit
  if (status?.isBranch && status.isExpired && !status.canAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-red-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-lg w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-semibold tracking-wide uppercase">
              Accès Restreint & Verrouillé
            </span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Votre abonnement est fini, veuillez recharger
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed pt-2">
              L'accès à la plateforme MyChurch pour la paroisse <strong className="text-white">{status.churchName}</strong> est suspendu suite à l'expiration de votre licence annuelle.
            </p>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-4 text-left border border-slate-700/60 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-white font-medium text-sm pb-1 border-b border-slate-700/60">
              <Sparkles className="w-4 h-4 text-amber-400" /> Options de réactivation :
            </div>
            <p>
              • <strong>Paiement direct par la paroisse :</strong> Vous pouvez renouveler immédiatement votre licence pour <strong>30 $ / an</strong> via Mobile Money ou Carte Bancaire.
            </p>
            {status.parentName && (
              <p>
                • <strong>Prise en charge par l’église mère :</strong> L’administrateur principal de <strong className="text-white">{status.parentName}</strong> peut également renouveler votre accès depuis son tableau de bord réseau.
              </p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <Button
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2 shadow-lg shadow-emerald-600/20"
              disabled={paying}
              onClick={() => handlePay('annual_branch')}
            >
              <RefreshCw className={`w-4 h-4 ${paying ? 'animate-spin' : ''}`} />
              Renouveler ma paroisse (30 $ / an)
            </Button>

            <Button
              variant="outline"
              className="w-full border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white gap-2 text-xs"
              onClick={() => logout()}
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </Button>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>{CREATOR}</span>
            <span>v{APP_VERSION}</span>
          </div>
        </div>
      </div>
    )
  }

  // 2. CAS AVANTAGE : Église Mère avec abonnement expiré -> Accès local maintenu mais bannière d'alerte
  const isHeadquartersExpired = status?.isHeadquarters && status?.isExpired

  return (
    <>
      {isHeadquartersExpired && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-2.5 text-xs md:text-sm font-medium shadow-md flex items-center justify-between gap-3 sticky top-0 z-50">
          <div className="flex items-center gap-2 truncate">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-200" />
            <span className="truncate">
              <strong>Votre abonnement est fini, veuillez recharger.</strong> Vos opérations locales restent actives, mais la création et la gestion de nouvelles églises affiliées sont restreintes.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs bg-white text-amber-900 hover:bg-amber-50 font-semibold"
              onClick={() => setPaymentOpen(true)}
            >
              Recharger maintenant
            </Button>
          </div>
        </div>
      )}

      {children}

      {/* Modal de rechargement pour l'Église Mère */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Recharger votre abonnement MyChurch
            </DialogTitle>
            <DialogDescription>
              Choisissez votre formule pour réactiver la gestion complète du réseau et des paroisses affiliées.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedPlan === 'annual'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-slate-300'
              }`}
              onClick={() => setSelectedPlan('annual')}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm">Formule Annuelle (Recommandée)</span>
                <span className="text-lg font-black text-primary">100 $ <span className="text-xs font-normal text-muted-foreground">/ an</span></span>
              </div>
              <p className="text-xs text-muted-foreground">
                Accès total pour l'église mère + possibilité d'affilier des églises pour seulement +30$/an.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedPlan === 'monthly'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-slate-300'
              }`}
              onClick={() => setSelectedPlan('monthly')}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm">Formule Mensuelle</span>
                <span className="text-lg font-black">50 $ <span className="text-xs font-normal text-muted-foreground">/ mois</span></span>
              </div>
              <p className="text-xs text-muted-foreground">
                Renouvelable chaque mois sans engagement.
              </p>
            </div>

            <Button
              className="w-full gap-2 text-sm font-semibold"
              disabled={paying}
              onClick={() => handlePay(selectedPlan)}
            >
              <RefreshCw className={`w-4 h-4 ${paying ? 'animate-spin' : ''}`} />
              Procéder au paiement ({selectedPlan === 'annual' ? '100 $' : '50 $'})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
