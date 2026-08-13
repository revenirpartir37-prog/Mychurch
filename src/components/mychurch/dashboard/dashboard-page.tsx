'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Users,
  DollarSign,
  Calendar,
  ClipboardCheck,
  ArrowRight,
  CreditCard,
  Send,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
  MapPin,
  X,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts'
import { useAppStore } from '@/store/app-store'
import { EmptyState } from '@/components/mychurch/shared/empty-state'
import { EVENT_LABELS, type EventType } from '@/lib/constants'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { canCreateMembers, canCreateFinances, canCreateEvents, canSendMessages, canViewFinances } from '@/lib/frontend-rbac'
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime'

interface DashboardStats {
  totalMembers: number
  monthlyRevenue: number
  totalExpense: number
  upcomingEvents: number
  monthlyAttendance: number
}

interface RecentMember {
  id: string
  firstName: string
  lastName: string
  createdAt: string
}

interface AuditLogEntry {
  id: string
  action: string
  details: string | null
  createdAt: string
  user?: { firstName: string; lastName: string }
}

interface UpcomingEvent {
  id: string
  title: string
  type: string
  startDate: string
  location: string | null
}

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  culte: { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', border: 'border-l-teal-500', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  reunion: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  seminar: { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-l-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  conference: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-l-rose-500', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  formation: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
}

export function DashboardPage() {
  const { auth, setCurrentView, unreadCount } = useAppStore()
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    monthlyRevenue: 0,
    totalExpense: 0,
    upcomingEvents: 0,
    monthlyAttendance: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [recentMembers, setRecentMembers] = useState<RecentMember[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [pendingDebts, setPendingDebts] = useState<any[]>([])
  const [pendingDebtsLoading, setPendingDebtsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const scrollYRef = useRef(0)
  const bienvenueRef = useRef<HTMLDivElement>(null)

  // Parallax effect for Bienvenue section
  useEffect(() => {
    const handleScroll = () => {
      scrollYRef.current = window.scrollY
      if (bienvenueRef.current) {
        const offset = window.scrollY * 0.15
        bienvenueRef.current.style.transform = `translateY(${offset}px)`
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Generate French day labels for last 7 days
  const getLast7DaysLabels = () => {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    const result: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      result.push(days[d.getDay()])
    }
    return result
  }

  const dayLabels = getLast7DaysLabels()

  // Generate sample attendance data based on fetched stats
  const getAttendanceData = () => {
    const base = stats.monthlyAttendance > 0 ? Math.round(stats.monthlyAttendance / 4) : 0
    return dayLabels.map((day) => ({
      name: day,
      présences: Math.max(0, base + Math.floor(Math.random() * 15) - 5),
    }))
  }

  const attendanceData = getAttendanceData()

  // French formatted date
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Realtime Supabase : rafraîchit le dashboard dès qu'une donnée change (en complément du polling)
  useSupabaseRealtime(['transaction', 'member', 'event', 'attendance', 'debt', 'notification'], () => loadDashboardData(), auth.churchId)

  async function loadDashboardData() {
    try {
      const token = auth.token
      const headers = { 'Authorization': `Bearer ${token}` }

      const res = await fetch('/api/dashboard', { headers })
      if (!res.ok) return
      const data = await res.json()

      const statsData = data.stats ?? {}
      setStats({
        totalMembers: statsData.totalMembers ?? 0,
        monthlyRevenue: statsData.monthlyRevenue ?? 0,
        totalExpense: statsData.totalExpense ?? 0,
        upcomingEvents: statsData.upcomingEvents ?? 0,
        monthlyAttendance: statsData.monthlyAttendance ?? 0,
      })

      setRecentTransactions(data.recentTransactions ?? [])
      setRecentMembers(data.recentMembers ?? [])
      setAuditLogs(data.auditLogs ?? [])
      setPendingDebts(data.pendingDebts ?? [])

      if (Array.isArray(data.upcomingEvents)) {
        const allEvents: UpcomingEvent[] = data.upcomingEvents.map((e: any) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          startDate: e.startDate,
          location: e.location,
        }))
        const now = new Date()
        setUpcomingEvents(allEvents.filter((e) => new Date(e.startDate) > now))
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefreshDashboard = async () => {
    setRefreshing(true)
    await loadDashboardData()
  }

  const handleApproveDebt = async (debtId: string, action: 'approved' | 'rejected', comment = '') => {
    try {
      const token = auth.token
      const res = await fetch('/api/debts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ debtId, action, comment }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(action === 'approved' ? 'Dette approuvée ✅' : 'Dette rejetée ❌')
        loadDashboardData()
      } else {
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  const statCards = [
    {
      title: 'Total Membres',
      value: stats.totalMembers,
      icon: Users,
      color: 'text-teal-500',
      bg: 'bg-teal-500/10',
      gradient: 'from-teal-500/5 via-teal-400/3 to-transparent',
      borderGradient: 'from-teal-400 via-teal-500 to-teal-600',
      view: 'members' as const,
    },
    ...(canViewFinances(auth.role) ? [{
      title: 'Compte rendus totaux',
      value: `${stats.monthlyRevenue.toFixed(2)} $`,
      icon: DollarSign,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      gradient: 'from-emerald-500/5 via-emerald-400/3 to-transparent',
      borderGradient: 'from-emerald-400 via-emerald-500 to-emerald-600',
      view: 'finances' as const,
    }] : []),
    {
      title: 'Événements',
      value: stats.upcomingEvents,
      icon: Calendar,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      gradient: 'from-amber-500/5 via-amber-400/3 to-transparent',
      borderGradient: 'from-amber-400 via-amber-500 to-amber-600',
      view: 'events' as const,
    },
    {
      title: 'Présences',
      value: stats.monthlyAttendance,
      icon: ClipboardCheck,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      gradient: 'from-rose-500/5 via-rose-400/3 to-transparent',
      borderGradient: 'from-rose-400 via-rose-500 to-rose-600',
      view: 'attendance' as const,
    },
  ]

  const quickActions = [
    ...(canCreateMembers(auth.role) ? [{ label: 'Ajouter Membre', description: 'Enregistrer un nouveau membre dans l\'église', icon: Users, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', gradient: 'from-emerald-500/5 to-emerald-500/0', view: 'members' as const }] : []),
    ...(canCreateFinances(auth.role) ? [{ label: 'Nouvelle Offrande', description: 'Enregistrer une offrande ou un don', icon: DollarSign, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', gradient: 'from-amber-500/5 to-amber-500/0', view: 'finances' as const }] : []),
    ...(canCreateEvents(auth.role) ? [{ label: 'Planifier Événement', description: 'Créer un nouvel événement pour l\'église', icon: Calendar, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', gradient: 'from-orange-500/5 to-orange-500/0', view: 'events' as const }] : []),
    { label: 'Générer Carte', description: 'Générer une carte de membre', icon: CreditCard, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', gradient: 'from-rose-500/5 to-rose-500/0', view: 'member-cards' as const },
    ...(canSendMessages(auth.role) ? [{ label: 'Envoyer Message', description: 'Envoyer un message aux membres', icon: Send, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', gradient: 'from-rose-500/5 to-rose-500/0', view: 'messages' as const, hasPulse: true }] : []),
    { label: 'Voir Rapports', description: 'Consulter les rapports et statistiques', icon: BarChart3, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10', gradient: 'from-teal-500/5 to-teal-500/0', view: 'reports' as const },
  ]

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Dîme': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
      'Offrande': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      'Dépense': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      'Don': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      'Charge': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    }
    return colors[category] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
  }

  const getAuditActionIcon = (action: string) => {
    if (action.startsWith('create') || action.startsWith('register')) return 'bg-emerald-500'
    if (action.startsWith('update')) return 'bg-amber-500'
    if (action.startsWith('delete')) return 'bg-red-500'
    if (action.startsWith('login')) return 'bg-teal-500'
    return 'bg-gray-400'
  }

  const getAuditActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create_member: 'Nouveau membre ajouté',
      update_member: 'Membre modifié',
      delete_member: 'Membre supprimé',
      create_transaction: 'Transaction créée',
      update_transaction: 'Transaction modifiée',
      delete_transaction: 'Transaction supprimée',
      create_event: 'Événement créé',
      update_event: 'Événement modifié',
      delete_event: 'Événement supprimé',
      login: 'Connexion',
      register: 'Inscription',
      import_members: 'Import membres',
      export_data: 'Export données',
      generate_card: 'Carte générée',
    }
    return labels[action] || action
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return "À l'instant"
    if (diffMin < 60) return `Il y a ${diffMin} min`
    if (diffHr < 24) return `Il y a ${diffHr}h`
    if (diffDay < 7) return `Il y a ${diffDay}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-6">
      {/* Bienvenue Section - with parallax and decorative pattern */}
      <div className="will-change-transform" ref={bienvenueRef}>
        <Card className="border-none bg-gradient-to-r from-primary/20 via-primary/10 to-transparent overflow-hidden">
          {/* Decorative cross/church motif */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M18 8h4v10h10v4H22v18h-4V22H8v-4h10z' fill='%23000' fill-opacity='1'/%3E%3C/svg%3E")`,
              backgroundSize: '40px 40px',
            }}
          />
          <CardContent className="p-6 relative">
            <div className="flex items-center gap-4">
              <img
                src="/logo-mychurch.png"
                alt="Logo"
                className="w-14 h-14 rounded-xl object-contain bg-white/80 dark:bg-gray-800/80 p-1.5 shadow-sm"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold truncate">
                  Bienvenue, {auth.firstName} !
                </h1>
                <p className="text-muted-foreground mt-1 truncate">
                  {auth.churchName} — Tableau de bord
                </p>
                <p className="text-sm text-muted-foreground/70 mt-0.5 capitalize">
                  {today}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
                onClick={handleRefreshDashboard}
                disabled={refreshing || loading}
              >
                <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-2 animate-pulse" />
                  <Skeleton className="h-8 w-16 animate-pulse" />
                  <Skeleton className="h-3 w-32 mt-2 animate-pulse" />
                </CardContent>
              </Card>
            ))
          : statCards.map((stat) => (
              <Card
                key={stat.title}
                className="hover:shadow-md transition-shadow overflow-hidden relative shimmer-animate"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, hsl(var(--card)) 40%, hsl(var(--card)) 60%, transparent 100%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-card 1.5s ease-out forwards',
                }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} pointer-events-none`} />
                {/* Animated gradient left border */}
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${stat.borderGradient} gradient-border-animate`} />
                <CardContent className="p-4 relative">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-3xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-4 rounded-xl ${stat.bg}`}>
                      <stat.icon className={`h-7 w-7 ${stat.color}`} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-1 text-muted-foreground hover:text-foreground gap-1"
                      onClick={() => setCurrentView(stat.view)}
                    >
                      Voir tout <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Actions rapides - Enhanced with tooltips and pulsing dot */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Actions rapides</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <Tooltip key={action.label}>
              <TooltipTrigger asChild>
                <Card
                  className="cursor-pointer border-border/50 transition-all duration-300 group hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 relative"
                  onClick={() => setCurrentView(action.view)}
                >
                  <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                  <CardContent className="p-4 flex flex-col items-center gap-2.5 text-center relative">
                    <div className="relative">
                      <div className={`p-3 rounded-xl ${action.bg} group-hover:scale-110 transition-all duration-300`}>
                        <action.icon className={`h-5 w-5 ${action.color}`} />
                      </div>
                      {/* Pulsing dot for messages when unread */}
                      {action.hasPulse && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 items-center justify-center text-[9px] text-white font-bold">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-foreground leading-tight">{action.label}</span>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                {action.description}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Demandes en attente (Admin seulement) */}
      {auth.role === 'admin' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Demandes d&apos;approbations en attente
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => setCurrentView('debts')}
            >
              Gérer les dettes <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          {pendingDebtsLoading ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-16 w-full animate-pulse" />
                <Skeleton className="h-16 w-full animate-pulse" />
              </CardContent>
            </Card>
          ) : pendingDebts.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-6">
                <EmptyState
                  icon={CheckCircle}
                  title="Aucune demande en attente"
                  description="Toutes les demandes de dettes ont été traitées"
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingDebts.map((debt) => (
                <Card key={debt.id} className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-500" />
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg text-amber-600 dark:text-amber-400">
                          {debt.amount.toFixed(2)} {debt.currency}
                        </span>
                        <Badge variant="outline" className="text-xs bg-amber-100/35 border-amber-300/40 text-amber-800 dark:text-amber-300">
                          Créancier: {debt.creditor}
                        </Badge>
                      </div>
                      {debt.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{debt.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground/75">
                        Soumis le {new Date(debt.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <Input
                        placeholder="Commentaire (optionnel)..."
                        className="h-9 text-xs sm:w-48 bg-background"
                        id={`comment-${debt.id}`}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs h-9 px-3 shrink-0"
                          onClick={() => {
                            const commentEl = document.getElementById(`comment-${debt.id}`) as HTMLInputElement
                            handleApproveDebt(debt.id, 'approved', commentEl?.value || '')
                          }}
                        >
                          <CheckCircle className="h-4 w-4" /> Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1 text-xs h-9 px-3 shrink-0"
                          onClick={() => {
                            const commentEl = document.getElementById(`comment-${debt.id}`) as HTMLInputElement
                            handleApproveDebt(debt.id, 'rejected', commentEl?.value || '')
                          }}
                        >
                          <X className="h-4 w-4" /> Rejeter
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prochains Événements Widget */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-500" />
            Prochains Événements
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={() => setCurrentView('events')}
          >
            Voir tout <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="min-w-[260px] shrink-0">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-16 w-14 rounded-xl animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32 animate-pulse" />
                      <Skeleton className="h-3 w-20 animate-pulse" />
                      <Skeleton className="h-3 w-28 animate-pulse" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : upcomingEvents.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={Calendar}
                title="Aucun événement à venir"
                description="Planifiez votre prochain événement"
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile: horizontal scroll */}
            <div className="flex gap-3 overflow-x-auto pb-2 md:hidden scrollbar-thin">
              {upcomingEvents.slice(0, 5).map((event) => {
                const eventDate = new Date(event.startDate)
                const typeColor = EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.culte
                return (
                  <Card
                    key={event.id}
                    className="min-w-[260px] max-w-[300px] shrink-0 hover:shadow-md transition-shadow cursor-pointer border-l-[3px]"
                    style={{ borderLeftColor: typeColor.border.replace('border-l-', '') === typeColor.border ? undefined : undefined }}
                    onClick={() => setCurrentView('events')}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${event.type === 'culte' ? 'from-teal-400 via-teal-500 to-teal-600' : event.type === 'reunion' ? 'from-amber-400 via-amber-500 to-amber-600' : event.type === 'seminar' ? 'from-orange-400 via-orange-500 to-orange-600' : event.type === 'conference' ? 'from-rose-400 via-rose-500 to-rose-600' : 'from-emerald-400 via-emerald-500 to-emerald-600'}`} />
                    <CardContent className="p-4 relative">
                      <div className="flex items-start gap-3">
                        {/* Date badge */}
                        <div className={`flex flex-col items-center justify-center h-16 w-14 rounded-xl ${typeColor.bg} shrink-0`}>
                          <span className="text-2xl font-bold leading-tight">
                            {eventDate.getDate()}
                          </span>
                          <span className="text-[10px] font-medium uppercase leading-none mt-0.5">
                            {format(eventDate, 'MMM', { locale: fr })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{event.title}</p>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 h-4 mt-1 border-0 ${typeColor.badge}`}
                          >
                            {EVENT_LABELS[event.type as EventType] || event.type}
                          </Badge>
                          {event.location && (
                            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            {/* Desktop: grid */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {upcomingEvents.slice(0, 5).map((event) => {
                const eventDate = new Date(event.startDate)
                const typeColor = EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.culte
                const borderGrad = event.type === 'culte' ? 'from-teal-400 via-teal-500 to-teal-600' : event.type === 'reunion' ? 'from-amber-400 via-amber-500 to-amber-600' : event.type === 'seminar' ? 'from-orange-400 via-orange-500 to-orange-600' : event.type === 'conference' ? 'from-rose-400 via-rose-500 to-rose-600' : 'from-emerald-400 via-emerald-500 to-emerald-600'
                return (
                  <Card
                    key={event.id}
                    className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden relative border-l-0"
                    onClick={() => setCurrentView('events')}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${borderGrad}`} />
                    <CardContent className="p-4 relative">
                      <div className="flex items-start gap-3">
                        <div className={`flex flex-col items-center justify-center h-16 w-14 rounded-xl ${typeColor.bg} shrink-0`}>
                          <span className="text-2xl font-bold leading-tight">
                            {eventDate.getDate()}
                          </span>
                          <span className="text-[10px] font-medium uppercase leading-none mt-0.5">
                            {format(eventDate, 'MMM', { locale: fr })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{event.title}</p>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 h-4 mt-1 border-0 ${typeColor.badge}`}
                          >
                            {EVENT_LABELS[event.type as EventType] || event.type}
                          </Badge>
                          {event.location && (
                            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Monthly Activity Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Fréquentation (7 derniers jours)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full animate-pulse" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPresences" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="présences"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorPresences)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions + Recent Members + Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Transactions récentes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCurrentView('finances')} className="gap-1">
              Voir tout <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full animate-pulse" />
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="Aucune transaction enregistrée"
                description="Les transactions récentes apparaîtront ici"
              />
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentTransactions.slice(0, 5).map((t: any) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-lg border-l-4 ${
                      t.type === 'revenue'
                        ? 'border-l-emerald-500 bg-emerald-500/5'
                        : 'border-l-red-500 bg-red-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg shrink-0 ${t.type === 'revenue' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                        {t.type === 'revenue' ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.description || t.category}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {new Date(t.date).toLocaleDateString('fr-FR')}
                          </span>
                          {t.category && (
                            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${getCategoryColor(t.category)}`}>
                              {t.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className={`font-semibold shrink-0 ml-2 ${t.type === 'revenue' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {t.type === 'revenue' ? '+' : '-'}{t.amount.toFixed(2)} {t.currency}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activité récente (Timeline) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-rose-500" />
              Activité récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full animate-pulse" />
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Aucune activité récente"
                description="Les actions récentes de votre église apparaîtront ici"
              />
            ) : (
              <div className="relative max-h-96 overflow-y-auto pl-6">
                {/* Vertical line */}
                <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="relative flex items-start gap-3">
                      {/* Dot */}
                      <div className={`absolute -left-4 top-1.5 h-3 w-3 rounded-full ring-2 ring-background ${getAuditActionIcon(log.action)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getAuditActionLabel(log.action)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système'}
                          </span>
                          <span className="text-xs text-muted-foreground/60">
                            · {formatTimeAgo(log.createdAt)}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{log.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Members (full width) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Membres récents</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('members')} className="gap-1">
            Voir tout <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full animate-pulse" />
              ))}
            </div>
          ) : recentMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun membre enregistré"
              description="Les nouveaux membres apparaîtront ici"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {recentMembers.slice(0, 6).map((m: RecentMember) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {getInitials(m.firstName, m.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Inscrit le {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setCurrentView('members')}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}