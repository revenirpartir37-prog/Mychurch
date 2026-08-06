'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { CREATOR, ROLE_LABELS, CURRENCY_LABELS, type Currency } from '@/lib/constants'
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
} from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'

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

  const fetchThresholds = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/threshold', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
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
      const res = await fetch('/api/settings/permissions', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
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
      const res = await fetch('/api/settings/threshold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
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
      const res = await fetch('/api/settings/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
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
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })

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
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [auth.token, auth.churchName])

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
      const res = await fetch(`/api/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
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
  }, [auth.token, auditPage, auditActionFilter, auditLimit])

  useEffect(() => {
    fetchAuditLogs()
  }, [fetchAuditLogs])

  const handleThemeChange = (themeId: 'professional' | 'light' | 'dark') => {
    setNextTheme(themeId)
    setStoreTheme(themeId)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const url = await uploadImage(file, 'logos', auth.token)
      await fetch('/api/settings/church-logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
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
        <TabsList className={`grid w-full ${auth.role === 'admin' ? 'grid-cols-7' : 'grid-cols-6'}`}>
          <TabsTrigger value="profil" className="gap-1.5 text-xs sm:text-sm">
            <User className="h-4 w-4 hidden sm:inline-block" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="eglise" className="gap-1.5 text-xs sm:text-sm">
            <Building2 className="h-4 w-4 hidden sm:inline-block" />
            Église
          </TabsTrigger>
          <TabsTrigger value="abonnement" className="gap-1.5 text-xs sm:text-sm">
            <CreditCard className="h-4 w-4 hidden sm:inline-block" />
            Abonnement
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-1.5 text-xs sm:text-sm">
            <Palette className="h-4 w-4 hidden sm:inline-block" />
            Thème
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs sm:text-sm">
            <Shield className="h-4 w-4 hidden sm:inline-block" />
            Journal d'audit
          </TabsTrigger>
          {auth.role === 'admin' && (
            <TabsTrigger value="admin" className="gap-1.5 text-xs sm:text-sm">
              <Crown className="h-4 w-4 hidden sm:inline-block" />
              Administration
            </TabsTrigger>
          )}
          <TabsTrigger value="apropos" className="gap-1.5 text-xs sm:text-sm">
            <Info className="h-4 w-4 hidden sm:inline-block" />
            À propos
          </TabsTrigger>
        </TabsList>

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
          <Card className="overflow-hidden">
            <div className="relative px-6 py-5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <Zap className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Plan Gratuit</h2>
                    <p className="text-sm text-white/80">Accès complet à toutes les fonctionnalités</p>
                  </div>
                </div>
                <Badge className="bg-white/20 text-white border-0">Actif</Badge>
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Tout est inclus — aucun paiement requis
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                MYCHURCH est entièrement gratuit. Vous avez accès à toutes les fonctionnalités :
                gestion des membres, finances, événements, présences, rapports, cartes de membres, et plus encore.
              </p>
            </CardContent>
          </Card>
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
              <CardTitle className="text-xl">MYCHURCH v1.0.0</CardTitle>
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

