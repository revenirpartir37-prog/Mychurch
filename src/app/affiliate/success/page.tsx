'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { APP_VERSION, CREATOR } from '@/lib/constants'

function AffiliateSuccessContent() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(6)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [router])

  return (
    <Card className="max-w-md w-full bg-slate-900/90 border-emerald-500/30 text-center p-8 space-y-6 shadow-2xl backdrop-blur-xl">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto animate-pulse">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> Affiliation Réseau Validée
        </span>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Paiement de 30 $ Confirmé !
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          Votre paroisse a été enregistrée avec succès dans le réseau. Votre abonnement annuel est maintenant actif pour les 365 prochains jours.
        </p>
      </div>

      <div className="bg-slate-800/80 rounded-xl p-4 text-left border border-slate-700/60 space-y-2 text-xs text-slate-300">
        <div className="flex items-center gap-2 text-white font-medium text-sm pb-1 border-b border-slate-700/60">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Vos accès MyChurch :
        </div>
        <p>• Tous les modules sont débloqués (Membres, Finances, Rapports, etc.)</p>
        <p>• Vous pouvez commander des cartes de membre à tout moment (10 $ / carte)</p>
        <p>• Rattaché directement au tableau de bord réseau de l'église mère</p>
      </div>

      <div className="space-y-3 pt-2">
        <Button
          size="lg"
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-sm shadow-lg shadow-emerald-600/20"
          onClick={() => router.push('/')}
        >
          Accéder à l'application ({countdown}s) <ArrowRight className="w-4 h-4" />
        </Button>

        <p className="text-[11px] text-slate-400">
          Redirection automatique dans <strong className="text-white">{countdown}</strong> secondes...
        </p>
      </div>

      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
        <span>{CREATOR}</span>
        <span>v{APP_VERSION}</span>
      </div>
    </Card>
  )
}

export default function AffiliateSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white">
      <Suspense fallback={<div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />}>
        <AffiliateSuccessContent />
      </Suspense>
    </div>
  )
}
