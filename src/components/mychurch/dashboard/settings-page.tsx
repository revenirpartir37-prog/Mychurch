'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { authFetch } from '@/lib/auth-fetch'
import { CREATOR, ROLE_LABELS, CURRENCY_LABELS, APP_VERSION, type Currency } from '@/lib/constants'
import { uploadImage } from '@/lib/upload-image'
import { useTheme } from 'next-themes'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Settings,
  User,
  Building2,
  CreditCard,
  Palette,
  Info,
  Shield,
  Crown,
  AlertTriangle,
  CheckCircle,
  LogOut,
  Smartphone,
  Globe,
  Search,
  Loader2,
  Calendar,
  ExternalLink,
  Zap,
  DollarSign,
  Image as ImageIcon,
  Upload,
  Timer,
  Clock,
  CheckCircle2,
  Sparkles,
  KeyRound,
  RefreshCw,
} from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { oneSignalLogout } from '@/components/mychurch/shared/onesignal-provider'
import {
  getPushPermissionState,
  isSubscribed,
  requestPushPermission,
  type PushPermissionState,
} from '@/lib/onesignal-client'

interface UserProfile {
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: string
}

interface ChurchInfo {
  name: string
  logo?: string | null
  address?: string
  city?: string
  province?: string
  country?: string
  currency?: string
  email?: string
}

const THEMES = [
  {
    id: 'professional' as const,
    name: 'Bleu Professionnel',
    preview: 'bg-slate-900',
    accent: 'bg-blue-500',
  },
  {
    id: 'light' as const,
    name: 'Blanc',
    preview: 'bg-white border border-gray-200',
    accent: 'bg-gray-900',
  },
  {
    id: 'dark' as const,
    name: 'Noir',
    preview: 'bg-zinc-900',
    accent: 'bg-zinc-400',
  },
]

function getActionColor(action: string): string {
  if (action.startsWith('create') || action.startsWith('register')) {
    return 'border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400'
  }
  if (action.startsWith('update')) {
    return 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400'
  }
  if (action.startsWith('delete')) {
    return 'border-red-500 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400'
  }
  if (action.startsWith('login')) {
    return 'border-purple-500 text-purple-700 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400'
  }
  return ''
}

// ────────────────────────────────────────────────────────────────
//  SUBSCRIPTION TAB — full pricing + live status
// ────────────────────────────────────────────────────────────────
interface SubStatus {
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

function useSubscriptionCountdown(endDateStr?: string) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  })

  useEffect(() => {
    if (!endDateStr) return

    const updateCountdown = () => {
      const end = new Date(endDateStr).getTime()
      const now = new Date().getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false })
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [endDateStr])

  return timeLeft
}

function SubscriptionTab() {
  const [sub, setSub] = useState<SubStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | 'annual_branch'>('annual')

  useEffect(() => {
    const isSuccess = typeof window !== 'undefined' && window.location.search.includes('payment=success')
    if (isSuccess) {
      setPaymentSuccess(true)
    }

    authFetch(isSuccess ? '/api/subscriptions?verify=true' : '/api/subscriptions')
      .then(r => r.json())
      .then(d => { setSub(d); if (d.isBranch) setSelectedPlan('annual_branch') })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const countdown = useSubscriptionCountdown(sub?.subscription?.endDate)

  const [adminCode, setAdminCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  const handlePay = async (plan: 'monthly' | 'annual' | 'annual_branch') => {
    setPaying(true)
    try {
      const res = await authFetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.paymentUrl) window.location.href = data.paymentUrl
      else toast.success('Paiement initié')
    } catch { toast.error('Erreur de paiement') }
    finally { setPaying(false) }
  }

  const handleRedeemCode = async () => {
    if (!adminCode.trim()) {
      toast.error('Veuillez saisir le code administrateur')
      return
    }
    setRedeeming(true)
    try {
      const res = await authFetch('/api/subscriptions/redeem-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: adminCode.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || 'Abonnement à vie activé !')
        setSub((prev) => prev ? {
          ...prev,
          isExpired: false,
          canAccess: true,
          subscription: data.subscription,
        } : null)
        setAdminCode('')
      } else {
        toast.error(data.error || 'Code administrateur incorrect')
      }
    } catch {
      toast.error('Erreur lors de la validation du code')
    } finally {
      setRedeeming(false)
    }
  }

  const planLabel = (plan?: string) => {
    if (!plan) return '—'
    if (plan === 'lifetime') return '👑 Abonnement à Vie (VIP Admin)'
    if (plan === 'trial') return '🎁 Essai Gratuit (7 Jours)'
    if (plan === 'annual') return 'Annuel Siège (100 $ / an)'
    if (plan === 'monthly') return 'Mensuel Siège (50 $ / mois)'
    if (plan === 'annual_branch') return 'Paroisse Affiliée (30 $ / an)'
    return plan
  }

  const endDateFmt = (d?: string, plan?: string) => {
    if (plan === 'lifetime') return 'À vie (Illimité)'
    return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
  }

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
    </div>
  )

  const isActive = sub?.subscription && !sub.isExpired
  const isExpired = sub?.isExpired

  return (
    <div className="space-y-6">

      {/* ── Bannière de confirmation après retour de paiement ── */}
      {paymentSuccess && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300 flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-bold text-sm">Paiement confirmé avec succès !</p>
            <p className="text-xs">Votre abonnement est actif et le compte à rebours est enclenché en temps réel.</p>
          </div>
        </div>
      )}

      {/* ── Statut actuel ── */}
      <Card className="overflow-hidden">
        <div className={`px-6 py-5 text-white ${isActive ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : isExpired ? 'bg-gradient-to-r from-red-600 to-rose-700' : 'bg-gradient-to-r from-slate-600 to-slate-700'}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
                <Zap className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {isActive ? planLabel(sub?.subscription?.plan) : isExpired ? 'Abonnement Expiré' : 'Aucun Abonnement Actif'}
                </h2>
                <p className="text-sm text-white/80">
                  {isActive
                    ? `Actif jusqu'au ${endDateFmt(sub?.subscription?.endDate)}`
                    : isExpired
                    ? `Expiré le ${endDateFmt(sub?.subscription?.endDate)}`
                    : 'Souscrivez pour débloquer toutes les fonctionnalités'}
                </p>
              </div>
            </div>
            <Badge className={`shrink-0 font-bold ${isActive ? 'bg-white/20 text-white border-0' : 'bg-white/20 text-white border-0'}`}>
              {isActive ? '✅ Actif' : isExpired ? '❌ Expiré' : '⏳ Inactif'}
            </Badge>
          </div>
        </div>

        {sub?.subscription && (
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">Formule</p>
                <p className="font-semibold">{planLabel(sub.subscription.plan)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">Statut</p>
                <p className="font-semibold capitalize">{sub.subscription.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">Expiration</p>
                <p className="font-semibold">{endDateFmt(sub.subscription.endDate, sub.subscription.plan)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">Type</p>
                <p className="font-semibold">{sub.isBranch ? '🔗 Paroisse Affiliée' : '👑 Siège Principal'}</p>
              </div>
            </div>

            {/* Compte à rebours ou Statut à vie */}
            {isActive && sub.subscription.plan === 'lifetime' ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-500">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Privilège Administrateur
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      Abonnement Permanent à Vie Activé
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Accès complet et gratuit à l&apos;application. Seuls l&apos;affiliation et les cartes restent payants.
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs font-bold shrink-0">
                  👑 Illimité
                </Badge>
              </div>
            ) : isActive ? (
              <div className="p-4 rounded-xl bg-muted/50 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <Timer className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Compte à rebours de l&apos;abonnement
                    </p>
                    <p className="text-2xl font-mono font-black text-foreground tracking-tight">
                      {countdown.days}j {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-bold gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Actif en direct
                </Badge>
              </div>
            ) : null}
          </CardContent>
        )}
      </Card>

      {/* ── Grille tarifaire ── */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" /> Nos formules d&apos;abonnement
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Plan Mensuel */}
          <div
            className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all space-y-3 ${!sub?.isBranch && selectedPlan === 'monthly' ? 'border-primary bg-primary/5 shadow' : 'border-border hover:border-primary/40'} ${sub?.isBranch ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => !sub?.isBranch && setSelectedPlan('monthly')}
          >
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-1">Siège d&apos;Église</p>
              <p className="text-lg font-bold">Formule Mensuelle</p>
              <div className="flex items-end gap-1 mt-1">
                <span className="text-3xl font-black">50</span>
                <span className="font-bold text-lg">$</span>
                <span className="text-muted-foreground text-sm mb-0.5">/ mois</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Sans engagement</p>
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {['Tous les modules débloqués','Membres & finances','Rapports & statistiques','Cartes (10 $ / unité)','Support prioritaire'].map(f => (
                <li key={f} className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />{f}</li>
              ))}
            </ul>
            {!sub?.isBranch && selectedPlan === 'monthly' && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <CheckCircle className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Plan Annuel */}
          <div
            className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all space-y-3 ${!sub?.isBranch && selectedPlan === 'annual' ? 'border-primary bg-primary/5 shadow' : 'border-border hover:border-primary/40'} ${sub?.isBranch ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => !sub?.isBranch && setSelectedPlan('annual')}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black">⭐ RECOMMANDÉ</span>
            </div>
            <div className="pt-2">
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-1">Siège d&apos;Église</p>
              <p className="text-lg font-bold">Formule Annuelle</p>
              <div className="flex items-end gap-1 mt-1">
                <span className="text-3xl font-black">100</span>
                <span className="font-bold text-lg">$</span>
                <span className="text-muted-foreground text-sm mb-0.5">/ an</span>
              </div>
              <p className="text-xs text-emerald-600 font-semibold mt-1">Économisez 500 $ vs mensuel</p>
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {['Tout le plan mensuel','Réseau d\'églises affiliées','Tableau de bord réseau','Cartes (10 $ / unité)','Support dédié 1 an'].map(f => (
                <li key={f} className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />{f}</li>
              ))}
            </ul>
            {!sub?.isBranch && selectedPlan === 'annual' && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <CheckCircle className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Plan Affilié */}
          <div
            className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all space-y-3 ${sub?.isBranch && selectedPlan === 'annual_branch' ? 'border-primary bg-primary/5 shadow' : 'border-border hover:border-primary/40'} ${!sub?.isBranch ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => sub?.isBranch && setSelectedPlan('annual_branch')}
          >
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-1">Paroisse Affiliée</p>
              <p className="text-lg font-bold">Extension Réseau</p>
              <div className="flex items-end gap-1 mt-1">
                <span className="text-3xl font-black">30</span>
                <span className="font-bold text-lg">$</span>
                <span className="text-muted-foreground text-sm mb-0.5">/ an</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Par paroisse affiliée</p>
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {['Tous les modules complets','Interface admin dédiée','Gestion autonome membres','Cartes (10 $ / unité)','Renouvellement Siège / Solo'].map(f => (
                <li key={f} className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />{f}</li>
              ))}
            </ul>
            {sub?.isBranch && selectedPlan === 'annual_branch' && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <CheckCircle className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bouton de paiement ── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 text-sm">
            <p className="font-semibold">
              {selectedPlan === 'monthly' ? 'Formule Mensuelle — 50 $ / mois'
               : selectedPlan === 'annual' ? 'Formule Annuelle — 100 $ / an (Recommandée)'
               : 'Extension Réseau — 30 $ / an'}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Facturation officielle en Dollars USD ({selectedPlan === 'monthly' ? '50 $ USD' : selectedPlan === 'annual' ? '100 $ USD' : '30 $ USD'}). Sur la passerelle sécurisée GeniusPay, l&apos;équivalent en devise de paiement locale (XOF / Mobile Money) est affiché pour débiter votre compte.
              {isActive && ' Renouvellement anticipé possible.'}
            </p>
          </div>
          <Button
            className="w-full sm:w-auto gap-2 font-bold shrink-0"
            disabled={paying}
            onClick={() => handlePay(selectedPlan)}
          >
            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {isActive ? 'Renouveler' : 'Souscrire'} ({selectedPlan === 'monthly' ? '50 $' : selectedPlan === 'annual' ? '100 $' : '30 $'})
          </Button>
        </CardContent>
      </Card>

      {/* ── Activation Code Secret Admin pour Abonnement à Vie ── */}
      <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-500" />
            Code Administrateur pour Abonnement à Vie
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
            Tapez le code administrateur s&apos;il vous a été accordé pour débloquer un abonnement permanent à vie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Saisir le code secret administrateur..."
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              className="font-mono text-xs uppercase"
            />
            <Button
              onClick={handleRedeemCode}
              disabled={redeeming || !adminCode.trim()}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold gap-2 text-xs shrink-0"
            >
              {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Valider le code
            </Button>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-300 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5 text-foreground">
              <Info className="w-4 h-4 text-amber-500 shrink-0" /> Précision importante sur l&apos;abonnement à vie :
            </p>
            <p className="leading-relaxed">
              Dans cet abonnement à vie, vous pourrez <strong>tout utiliser gratuitement</strong> dans l&apos;application sans aucune limite de temps. La seule chose qui reste payante, c&apos;est <strong>l&apos;affiliation de nouvelles églises</strong> (50 $ / mois ou 100 $ / an pour ouvrir le réseau) et <strong>la commande des cartes de membres</strong> (10 $ / carte).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Note cartes ── */}
      <Card className="border-dashed">
        <CardContent className="p-4 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Cartes de membre — Paiement séparé à la demande</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Les cartes ne font pas partie de l&apos;abonnement. Chaque carte coûte <strong>10 $ USD</strong> et peut être achetée à tout moment en packs de 20, 60 ou quantité personnalisée, que vous soyez un Siège ou une Paroisse Affiliée.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function SettingsPage() {
  const auth = useAppStore((s) => s.auth)
  const logout = useAppStore((s) => s.logout)
  const storeTheme = useAppStore((s) => s.theme)
  const setStoreTheme = useAppStore((s) => s.setTheme)
  const { theme: nextTheme, setTheme: setNextTheme } = useTheme()

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [churchInfo, setChurchInfo] = useState<ChurchInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [logoUploading, setLogoUploading] = useState(false)

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditActionFilter, setAuditActionFilter] = useState('')
  const auditLimit = 20

  // Admin threshold & RBAC states
  const [usdThreshold, setUsdThreshold] = useState('')
  const [cdfThreshold, setCdfThreshold] = useState('')
  const [thresholdSaving, setThresholdSaving] = useState(false)
  const [customPermissions, setCustomPermissions] = useState<Record<string, string[]>>({
    treasurer: [],
    secretary: [],
    reader: [],
  })
  const [permissionsSaving, setPermissionsSaving] = useState(false)
  const [pushPermission, setPushPermission] = useState<PushPermissionState>('default')
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  const refreshPushState = useCallback(async () => {
    const [permission, subscribed] = await Promise.all([
      getPushPermissionState(),
      isSubscribed(),
    ])
    setPushPermission(permission)
    setPushSubscribed(subscribed)
  }, [])

  const fetchThresholds = useCallback(async () => {
    try {
      const res = await authFetch('/api/settings/threshold')
      if (res.ok) {
        const data = await res.json()
        setUsdThreshold(String(data.debt_threshold_usd))
        setCdfThreshold(String(data.debt_threshold_cdf))
      }
    } catch (e) {
      console.error(e)
    }
  }, [auth.token])

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await authFetch('/api/settings/permissions')
      if (res.ok) {
        const data = await res.json()
        setCustomPermissions(data.custom)
      }
    } catch (e) {
      console.error(e)
    }
  }, [auth.token])

  useEffect(() => {
    if (auth.role === 'admin') {
      fetchThresholds()
      fetchPermissions()
    }
  }, [auth.role, fetchThresholds, fetchPermissions])

  const handleSaveThresholds = async () => {
    setThresholdSaving(true)
    try {
      const res = await authFetch('/api/settings/threshold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          debt_threshold_usd: parseFloat(usdThreshold) || 0,
          debt_threshold_cdf: parseFloat(cdfThreshold) || 0,
        }),
      })
      if (res.ok) {
        toast.success('Seuils d\'approbation mis à jour avec succès ✅')
        fetchThresholds()
      } else {
        toast.error('Erreur lors de la mise à jour des seuils')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setThresholdSaving(false)
    }
  }

  const handleTogglePermission = (role: string, permKey: string) => {
    setCustomPermissions(prev => {
      const perms = prev[role] || []
      const updated = perms.includes(permKey)
        ? perms.filter(p => p !== permKey)
        : [...perms, permKey]
      return { ...prev, [role]: updated }
    })
  }

  const handleSavePermissions = async (role: 'treasurer' | 'secretary' | 'reader') => {
    setPermissionsSaving(true)
    try {
      const res = await authFetch('/api/settings/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role,
          permissions: customPermissions[role] || [],
        }),
      })
      if (res.ok) {
        toast.success(`Permissions du rôle ${ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role} mises à jour avec succès ✅`)
        fetchPermissions()
      } else {
        toast.error('Erreur lors de la mise à jour des permissions')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setPermissionsSaving(false)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const meRes = await authFetch('/api/auth/me')

      if (meRes.ok) {
        const meData = await meRes.json()
        const user = meData.user ?? meData
        const church = meData.church ?? {}
        setUserProfile({
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          email: user.email ?? '',
          phone: user.phone ?? '',
          role: user.role ?? '',
        })
        setChurchInfo({
          name: church.name ?? auth.churchName ?? '',
          logo: church.logo ?? null,
          address: church.address ?? '',
          city: church.city ?? '',
          province: church.province ?? '',
          country: church.country ?? '',
          currency: church.currency ?? 'USD',
          email: church.email ?? '',
        })
      }
      await refreshPushState()
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [auth.churchName, refreshPushState])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async (page?: number) => {
    setAuditLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page ?? auditPage),
        limit: String(auditLimit),
        ...(auditActionFilter && { action: auditActionFilter }),
      })
      const res = await authFetch(`/api/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAuditLogs(data.logs ?? [])
        setAuditTotal(data.pagination?.total ?? 0)
      }
    } catch {
      // silent
    } finally {
      setAuditLoading(false)
    }
  }, [auditPage, auditActionFilter, auditLimit])

  useEffect(() => {
    fetchAuditLogs()
  }, [fetchAuditLogs])

  const handleThemeChange = (themeId: 'professional' | 'light' | 'dark') => {
    setNextTheme(themeId)
    setStoreTheme(themeId)
  }

  const handleEnablePush = async () => {
    setPushLoading(true)
    try {
      await requestPushPermission()
      await refreshPushState()
      toast.success('Notifications push activées avec succès')
    } catch (error) {
      await refreshPushState()
      toast.error(error instanceof Error ? error.message : 'Activation des notifications impossible')
    } finally {
      setPushLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const url = await uploadImage(file, 'logos', auth.token)
      await authFetch('/api/settings/church-logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logo: url }),
      })
      setChurchInfo((prev) => prev ? { ...prev, logo: url } : prev)
      useAppStore.getState().setAuth({ churchLogo: url })
      toast.success('Logo de l\'église mis à jour')
    } catch {
      toast.error('Erreur lors de l\'envoi du logo')
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/50">
          <Settings className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
      </div>

      <Separator />

      <Tabs defaultValue="profil" className="space-y-6">
        <div className="w-full overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
          <TabsList className={`grid w-max grid-flow-col auto-cols-fr sm:w-full ${auth.role === 'admin' ? 'sm:grid-cols-7' : 'sm:grid-cols-6'} sm:grid-flow-row`}>
            <TabsTrigger value="profil" className="gap-1.5 text-xs sm:text-sm min-w-[7.5rem] sm:min-w-0">
              <User className="h-4 w-4" />
              Profil
            </TabsTrigger>
            <TabsTrigger value="eglise" className="gap-1.5 text-xs sm:text-sm min-w-[7.5rem] sm:min-w-0">
              <Building2 className="h-4 w-4" />
              Église
            </TabsTrigger>
            <TabsTrigger value="abonnement" className="gap-1.5 text-xs sm:text-sm min-w-[7.5rem] sm:min-w-0">
              <CreditCard className="h-4 w-4" />
              Abonnement
            </TabsTrigger>
            <TabsTrigger value="theme" className="gap-1.5 text-xs sm:text-sm min-w-[7.5rem] sm:min-w-0">
              <Palette className="h-4 w-4" />
              Thème
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs sm:text-sm min-w-[7.5rem] sm:min-w-0">
              <Shield className="h-4 w-4" />
              Journal d'audit
            </TabsTrigger>
            {auth.role === 'admin' && (
              <TabsTrigger value="admin" className="gap-1.5 text-xs sm:text-sm min-w-[7.5rem] sm:min-w-0">
                <Crown className="h-4 w-4" />
                Administration
              </TabsTrigger>
            )}
            <TabsTrigger value="apropos" className="gap-1.5 text-xs sm:text-sm min-w-[7.5rem] sm:min-w-0">
              <Info className="h-4 w-4" />
              À propos
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ==================== PROFIL TAB ==================== */}
        <TabsContent value="profil" className="space-y-4">
          {/* Profile completion progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Profil complété à</span>
              <span className="font-semibold text-primary">
                {userProfile
                  ? Math.round(
                      ([
                        userProfile.firstName,
                        userProfile.lastName,
                        userProfile.email,
                        userProfile.phone,
                      ].filter(Boolean).length /
                        4) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-700 ease-out"
                style={{
                  width: `${userProfile
                    ? Math.round(
                        ([
                          userProfile.firstName,
                          userProfile.lastName,
                          userProfile.email,
                          userProfile.phone,
                        ].filter(Boolean).length /
                          4) *
                          100
                      )
                    : 0}%`,
                }}
              />
            </div>
          </div>

          <Card className="hover:shadow-md transition-all duration-200">
            <CardHeader className="flex flex-row items-center gap-4">
              {/* Gradient avatar circle */}
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 opacity-60 blur-[2px]" />
                <Avatar className="h-16 w-16 relative">
                  <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-violet-500 to-purple-600 text-white border-2 border-background">
                    {userProfile
                      ? userProfile.firstName?.[0]?.toUpperCase() ?? ''
                      : '?'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">
                  {userProfile
                    ? `${userProfile.firstName} ${userProfile.lastName}`
                    : 'Chargement...'}
                </CardTitle>
                <CardDescription>
                  {userProfile?.email}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" disabled>
                <Settings className="mr-2 h-4 w-4" />
                Modifier
              </Button>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 group hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors duration-200">
                  <Label className="text-muted-foreground text-xs">Nom complet</Label>
                  <p className="text-sm font-medium">
                    {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : '—'}
                  </p>
                </div>
                <div className="space-y-2 group hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors duration-200">
                  <Label className="text-muted-foreground text-xs">Adresse e-mail</Label>
                  <p className="text-sm font-medium">{userProfile?.email ?? '—'}</p>
                </div>
                <div className="space-y-2 group hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors duration-200">
                  <Label className="text-muted-foreground text-xs">Téléphone</Label>
                  <p className="text-sm font-medium">{userProfile?.phone ?? '—'}</p>
                </div>
                <div className="space-y-2 group hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors duration-200">
                  <Label className="text-muted-foreground text-xs">Rôle</Label>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-500" />
                    <p className="text-sm font-medium">
                      {userProfile?.role ? ROLE_LABELS[userProfile.role as keyof typeof ROLE_LABELS] ?? userProfile.role : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50">
                <Smartphone className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">Notifications push</CardTitle>
                <CardDescription>
                  Recevez les messages, actions et rappels d&apos;événements même application fermée
                </CardDescription>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Statut des notifications</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Permission: {pushPermission} • Abonnement actif: {pushSubscribed ? 'Oui' : 'Non'}
                  </p>
                </div>
                <Badge variant={pushSubscribed ? 'default' : 'secondary'}>
                  {pushSubscribed ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
              <Button
                onClick={handleEnablePush}
                disabled={pushLoading || pushSubscribed}
                className="gap-2"
              >
                {pushLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {pushSubscribed ? 'Déjà activé ✓' : 'Activer les notifications'}
              </Button>
              {pushPermission === 'denied' && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Les notifications sont bloquées par le navigateur. Autorisez-les dans les paramètres du site.
                </p>
              )}
            </CardContent>
          </Card>

          {/* App Version & Update */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/50">
                <RefreshCw className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-base">Mise à jour de l&apos;application</CardTitle>
                <CardDescription>Version installée : v{APP_VERSION}</CardDescription>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cliquez sur le bouton ci-dessous pour vérifier si une nouvelle version de MYCHURCH est disponible et l&apos;installer immédiatement.
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready
                      .then((reg) => reg.update())
                      .then(() => {
                        toast.success(`Application à jour — v${APP_VERSION}`)
                      })
                      .catch(() => {
                        toast.info('Aucune mise à jour disponible pour l\'instant')
                      })
                  } else {
                    window.location.reload()
                  }
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Vérifier les mises à jour
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ÉGLISE TAB ==================== */}
        <TabsContent value="eglise" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{churchInfo?.name ?? '—'}</CardTitle>
                <CardDescription>Informations de votre église</CardDescription>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-6">
              {/* Logo Upload */}
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 opacity-40 blur-sm group-hover:opacity-60 transition-opacity" />
                  <div className="relative h-24 w-24 rounded-xl bg-muted flex items-center justify-center overflow-hidden border-2 border-background">
                    {churchInfo?.logo ? (
                      <img src={churchInfo.logo} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Logo de l&apos;église</Label>
                  <p className="text-xs text-muted-foreground">
                    Affiché sur les cartes de membres et les rapports PDF
                  </p>
                  {auth.role === 'admin' ? (
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                        disabled={logoUploading}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={logoUploading}
                        asChild
                      >
                        <span>
                          {logoUploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          {logoUploading ? 'Envoi...' : 'Changer le logo'}
                        </span>
                      </Button>
                    </label>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Seul l&apos;administrateur peut modifier le logo
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Church Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Nom</Label>
                  <p className="text-sm font-medium">{churchInfo?.name ?? '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Adresse e-mail</Label>
                  <p className="text-sm font-medium">{churchInfo?.email ?? '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Adresse</Label>
                  <p className="text-sm font-medium">{churchInfo?.address ?? '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Ville</Label>
                  <p className="text-sm font-medium">{churchInfo?.city ?? '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Province</Label>
                  <p className="text-sm font-medium">{churchInfo?.province ?? '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Pays</Label>
                  <p className="text-sm font-medium">{churchInfo?.country ?? '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Devise</Label>
                  <p className="text-sm font-medium">
                    {churchInfo?.currency
                      ? CURRENCY_LABELS[churchInfo.currency as Currency] ?? churchInfo.currency
                      : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">{CREATOR}</p>
        </TabsContent>

        {/* ==================== ABONNEMENT TAB ==================== */}
        <TabsContent value="abonnement" className="space-y-6">
          <SubscriptionTab />
        </TabsContent>

        {/* ==================== THÈME TAB ==================== */}
        <TabsContent value="theme" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-5 w-5 text-violet-500" />
                Thème de l&apos;application
              </CardTitle>
              <CardDescription>
                Choisissez le thème qui vous convient le mieux
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {THEMES.map((t) => {
                  const isActive = nextTheme === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleThemeChange(t.id)}
                      className={`group relative rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
                        isActive
                          ? 'border-violet-500 ring-2 ring-violet-500/30 shadow-md'
                          : 'border-border hover:border-violet-300 dark:hover:border-violet-700'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="h-5 w-5 text-violet-500" />
                        </div>
                      )}
                      {/* Preview */}
                      <div className={`mb-4 h-24 rounded-lg ${t.preview} p-3 relative overflow-hidden`}>
                        <div className={`absolute bottom-0 left-0 right-0 h-2 ${t.accent}`} />
                        <div className="mt-1 space-y-1.5">
                          <div
                            className={`h-2 w-3/4 rounded ${t.id === 'light' ? 'bg-gray-300' : 'bg-white/20'}`}
                          />
                          <div
                            className={`h-2 w-1/2 rounded ${t.id === 'light' ? 'bg-gray-200' : 'bg-white/10'}`}
                          />
                          <div
                            className={`h-2 w-5/6 rounded ${t.id === 'light' ? 'bg-gray-200' : 'bg-white/10'}`}
                          />
                        </div>
                      </div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">{t.id}</p>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== JOURNAL D'AUDIT TAB ==================== */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-violet-500" />
                Journal d&apos;audit
              </CardTitle>
              <CardDescription>
                Historique des actions effectuées dans l&apos;église
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search by action */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrer par type d&apos;action (ex: login, create_member...)"
                    value={auditActionFilter}
                    onChange={(e) => { setAuditActionFilter(e.target.value); setAuditPage(1) }}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Audit log table */}
              <div className="max-h-96 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Date</TableHead>
                      <TableHead className="w-40">Action</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead className="hidden sm:table-cell">Détails</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                        </TableRow>
                      ))
                    ) : auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Aucune entrée d&apos;audit trouvée
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log: any) => {
                        const actionColor = getActionColor(log.action)
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString('fr-FR')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={actionColor}>
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.user
                                ? `${log.user.firstName} ${log.user.lastName}`
                                : 'Utilisateur inconnu'}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground truncate max-w-60">
                              {log.details || '—'}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {Math.ceil(auditTotal / auditLimit) > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {auditPage} sur {Math.ceil(auditTotal / auditLimit)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPage <= 1}
                      onClick={() => { setAuditPage((p) => p - 1); fetchAuditLogs(auditPage - 1) }}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPage >= Math.ceil(auditTotal / auditLimit)}
                      onClick={() => { setAuditPage((p) => p + 1); fetchAuditLogs(auditPage + 1) }}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ADMINISTRATION TAB ==================== */}
        {auth.role === 'admin' && (
          <TabsContent value="admin" className="space-y-6">
            {/* Threshold settings card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-violet-500" />
                  Seuils de validation automatique des dettes
                </CardTitle>
                <CardDescription>
                  Configurez le montant maximal des dettes qui sont automatiquement approuvées sans validation manuelle de l'administrateur.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="threshold-usd">Seuil de validation USD ($)</Label>
                    <Input
                      id="threshold-usd"
                      type="number"
                      value={usdThreshold}
                      onChange={(e) => setUsdThreshold(e.target.value)}
                      placeholder="Ex: 500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="threshold-cdf">Seuil de validation FC (CDF)</Label>
                    <Input
                      id="threshold-cdf"
                      type="number"
                      value={cdfThreshold}
                      onChange={(e) => setCdfThreshold(e.target.value)}
                      placeholder="Ex: 1000000"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveThresholds} disabled={thresholdSaving}>
                  {thresholdSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sauvegarder les seuils
                </Button>
              </CardContent>
            </Card>

            {/* RBAC custom permissions matrix card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-violet-500" />
                  Permissions des rôles (RBAC)
                </CardTitle>
                <CardDescription>
                  Définissez les droits d'accès granulaires pour les différents rôles d'utilisateurs. L'administrateur conserve toujours tous les accès.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {['treasurer', 'secretary', 'reader'].map((role) => {
                  const roleKey = role as 'treasurer' | 'secretary' | 'reader'
                  return (
                    <div key={role} className="border rounded-lg p-4 space-y-4 bg-muted/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crown className="h-5 w-5 text-violet-500" />
                          <h3 className="font-semibold text-sm">
                            Permissions : {ROLE_LABELS[roleKey]}
                          </h3>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSavePermissions(roleKey)}
                          disabled={permissionsSaving}
                        >
                          Enregistrer les droits
                        </Button>
                      </div>
                      <Separator />
                      
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[
                          {
                            category: "Finances & Dettes",
                            permissions: [
                              { key: 'finances:view', name: 'Voir les finances' },
                              { key: 'finances:create', name: 'Créer des transactions' },
                              { key: 'finances:edit', name: 'Modifier des transactions' },
                              { key: 'finances:delete', name: 'Supprimer des transactions' },
                              { key: 'finances:approve', name: 'Approuver des transactions' },
                              { key: 'debts:view', name: 'Voir les dettes' },
                              { key: 'debts:create', name: 'Créer des dettes' },
                              { key: 'debts:pay', name: 'Rembourser des dettes' },
                              { key: 'debts:approve', name: 'Approuver des dettes' },
                              { key: 'debts:delete', name: 'Supprimer des dettes' },
                            ]
                          },
                          {
                            category: "Membres",
                            permissions: [
                              { key: 'members:view', name: 'Voir les membres' },
                              { key: 'members:create', name: 'Créer des membres' },
                              { key: 'members:edit', name: 'Modifier des membres' },
                              { key: 'members:delete', name: 'Supprimer des membres' },
                              { key: 'members:export', name: 'Exporter les membres' },
                            ]
                          },
                          {
                            category: "Cultes & Événements",
                            permissions: [
                              { key: 'events:view', name: 'Voir les événements' },
                              { key: 'events:create', name: 'Créer des événements' },
                              { key: 'events:edit', name: 'Modifier des événements' },
                              { key: 'events:delete', name: 'Supprimer des événements' },
                              { key: 'attendance:view', name: 'Voir les présences' },
                              { key: 'attendance:create', name: 'Enregistrer les présences' },
                              { key: 'attendance:edit', name: 'Modifier les présences' },
                              { key: 'attendance:delete', name: 'Supprimer les présences' },
                            ]
                          },
                          {
                            category: "Communication",
                            permissions: [
                              { key: 'messages:view', name: 'Voir la messagerie' },
                              { key: 'messages:send', name: 'Envoyer des messages' },
                              { key: 'messages:delete', name: 'Supprimer des messages' },
                            ]
                          },
                          {
                            category: "Rapports & Archives",
                            permissions: [
                              { key: 'reports:view', name: 'Consulter les rapports' },
                              { key: 'reports:export', name: 'Exporter les rapports' },
                              { key: 'reports:print', name: 'Imprimer les rapports' },
                              { key: 'archives:view', name: 'Voir les archives' },
                              { key: 'archives:create', name: 'Créer des archives' },
                              { key: 'archives:restore', name: 'Restaurer des archives' },
                              { key: 'archives:download', name: 'Télécharger des archives' },
                              { key: 'archives:delete', name: 'Supprimer des archives' },
                            ]
                          },
                          {
                            category: "Utilisateurs",
                            permissions: [
                              { key: 'users:view', name: 'Voir les utilisateurs' },
                              { key: 'users:manage', name: 'Gérer les utilisateurs' },
                              { key: 'users:suspend', name: 'Suspendre des utilisateurs' },
                              { key: 'users:reactivate', name: 'Réactiver des utilisateurs' },
                            ]
                          }
                        ].map((group) => (
                          <div key={group.category} className="space-y-2">
                            <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">
                              {group.category}
                            </h4>
                            <div className="space-y-2.5">
                              {group.permissions.map((p) => {
                                const isChecked = (customPermissions[role] || []).includes(p.key)
                                return (
                                  <div key={p.key} className="flex items-center justify-between text-sm group hover:bg-muted/40 p-1 rounded transition-colors">
                                    <span className="text-muted-foreground">{p.name}</span>
                                    <Switch
                                      checked={isChecked}
                                      onCheckedChange={() => handleTogglePermission(role, p.key)}
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ==================== À PROPOS TAB ==================== */}
        <TabsContent value="apropos" className="space-y-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2">
                <img
                  src="/logo-mychurch.png"
                  alt="MYCHURCH"
                  className="h-20 w-20 object-contain"
                />
              </div>
              <CardTitle className="text-xl">MYCHURCH v{APP_VERSION}</CardTitle>
              <CardDescription>Plateforme de gestion d&apos;église</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                MYCHURCH est une plateforme complète pour la gestion de votre église.
                Gérez vos membres, finances, événements, présences et communications en un seul endroit.
              </p>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-3 group hover:bg-muted/30 rounded-lg p-2 -m-2 transition-all duration-200 hover:shadow-sm">
                  <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-950/50 group-hover:bg-violet-200 dark:group-hover:bg-violet-950 transition-colors">
                    <Shield className="h-4 w-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Gestion des membres</p>
                    <p className="text-xs text-muted-foreground">Suivi complet des membres, cartes, départements</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 group hover:bg-muted/30 rounded-lg p-2 -m-2 transition-all duration-200 hover:shadow-sm">
                  <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-950/50 group-hover:bg-violet-200 dark:group-hover:bg-violet-950 transition-colors">
                    <DollarSign className="h-4 w-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Finances & dettes</p>
                    <p className="text-xs text-muted-foreground">Gestion des recettes, dépenses et dettes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 group hover:bg-muted/30 rounded-lg p-2 -m-2 transition-all duration-200 hover:shadow-sm">
                  <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-950/50 group-hover:bg-violet-200 dark:group-hover:bg-violet-950 transition-colors">
                    <Calendar className="h-4 w-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Événements & présences</p>
                    <p className="text-xs text-muted-foreground">Planification des cultes et suivi des présences</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 group hover:bg-muted/30 rounded-lg p-2 -m-2 transition-all duration-200 hover:shadow-sm">
                  <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-950/50 group-hover:bg-violet-200 dark:group-hover:bg-violet-950 transition-colors">
                    <Smartphone className="h-4 w-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Application mobile (PWA)</p>
                    <p className="text-xs text-muted-foreground">Installable sur téléphone, accessible partout</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 group hover:bg-muted/30 rounded-lg p-2 -m-2 transition-all duration-200 hover:shadow-sm">
                  <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-950/50 group-hover:bg-violet-200 dark:group-hover:bg-violet-950 transition-colors">
                    <Globe className="h-4 w-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Multidevise & multilingue</p>
                    <p className="text-xs text-muted-foreground">Supporte USD, FC, EUR — Interface en français</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="text-center py-2">
                <p className="text-lg font-semibold text-violet-600 dark:text-violet-400">
                  {CREATOR}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Logout button */}
          <Button
            variant="outline"
            className="w-full gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => {
              oneSignalLogout()
              logout()
              toast.success('Déconnexion réussie')
            }}
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}
