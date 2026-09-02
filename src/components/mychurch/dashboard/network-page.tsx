'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Network,
  Users,
  CreditCard,
  Building2,
  Copy,
  Share2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface AffiliateBranch {
  id: string
  name: string
  city: string
  country: string
  email: string
  phone?: string
  memberCount: number
  cardCount: number
  userCount: number
  adminUser?: {
    firstName: string
    lastName: string
    email: string
    phone?: string
  }
  createdAt: string
  isExpired: boolean
  subscription?: {
    plan: string
    status: string
    endDate: string
  }
}

export function NetworkPage() {
  const [loading, setLoading] = useState(true)
  const [isHeadquarters, setIsHeadquarters] = useState(true)
  const [isHeadquartersExpired, setIsHeadquartersExpired] = useState(false)
  const [affiliationUrl, setAffiliationUrl] = useState('')
  const [affiliationCode, setAffiliationCode] = useState('')
  const [affiliates, setAffiliates] = useState<AffiliateBranch[]>([])
  const [renewModalOpen, setRenewModalOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<AffiliateBranch | null>(null)
  const [paying, setPaying] = useState(false)

  const fetchAffiliates = async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/affiliates')
      if (res.ok) {
        const data = await res.json()
        setIsHeadquarters(data.isHeadquarters)
        setIsHeadquartersExpired(!!data.isHeadquartersExpired)
        setAffiliationCode(data.affiliationCode || '')
        setAffiliationUrl(data.affiliationUrl || '')
        setAffiliates(data.affiliates || [])
      }
    } catch (err) {
      console.error('Fetch affiliates error:', err)
      toast.error('Erreur lors du chargement des églises affiliées')
    } finally {
      setLoading(false)
    }
  }

  const handlePayHQ = async (plan: 'monthly' | 'annual') => {
    setPaying(true)
    try {
      const res = await authFetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      } else {
        toast.success('Paiement initié')
      }
    } catch {
      toast.error('Erreur lors du paiement')
    } finally {
      setPaying(false)
    }
  }

  useEffect(() => {
    fetchAffiliates()
  }, [])

  const handleCopyLink = () => {
    if (!affiliationUrl) return
    navigator.clipboard.writeText(affiliationUrl)
    toast.success('Lien d\'affiliation copié dans le presse-papiers !')
  }

  const handleShareWhatsapp = () => {
    if (!affiliationUrl) return
    const text = encodeURIComponent(
      `Rejoignez notre réseau d'églises sur MyChurch et activez votre paroisse affiliée en cliquant sur ce lien : ${affiliationUrl}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleRegenerateCode = async () => {
    try {
      const res = await authFetch('/api/affiliates', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setAffiliationCode(data.affiliationCode)
        setAffiliationUrl(data.affiliationUrl)
        toast.success('Nouveau code d\'affiliation généré !')
      }
    } catch {
      toast.error('Erreur lors de la régénération du code')
    }
  }

  const handlePayBranchRenewal = async () => {
    if (!selectedBranch) return
    setPaying(true)
    try {
      const res = await authFetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'annual_branch',
          targetChurchId: selectedBranch.id,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl
        } else {
          toast.success('Paiement initié avec succès')
        }
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors du paiement')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setPaying(false)
    }
  }

  const totalNetworkMembers = affiliates.reduce((sum, a) => sum + a.memberCount, 0)
  const totalNetworkCards = affiliates.reduce((sum, a) => sum + a.cardCount, 0)

  if (!isHeadquarters && !loading) {
    return (
      <div className="p-8 text-center max-w-md mx-auto space-y-4">
        <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Paroisse Affiliée</h2>
        <p className="text-sm text-muted-foreground">
          Votre communauté est rattachée à son Église Mère. Seul l'administrateur du Siège gère le réseau global.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Network className="w-7 h-7 text-primary" />
            Mon Réseau & Églises Affiliées
          </h1>
          <p className="text-sm text-muted-foreground">
            Supervisez vos paroisses, affiliez de nouvelles églises et gérez les abonnements réseau.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 via-transparent to-transparent border-blue-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold">Paroisses Affiliées</CardDescription>
            <CardTitle className="text-3xl font-black text-blue-600 dark:text-blue-400">
              {affiliates.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Églises filles actives dans le réseau
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold">Fidèles du Réseau</CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {totalNetworkMembers}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Membres cumulés des églises affiliées
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 via-transparent to-transparent border-purple-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold">Cartes Émises</CardDescription>
            <CardTitle className="text-3xl font-black text-purple-600 dark:text-purple-400">
              {totalNetworkCards}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Total des cartes de membres générées
          </CardContent>
        </Card>
      </div>

      {/* Invitation Box ou Blocage si pas d'abonnement Siège */}
      {isHeadquartersExpired ? (
        <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="font-bold text-base text-foreground">
                Système d&apos;affiliation inactif — Abonnement Siège requis
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pour débloquer et utiliser le système d&apos;affiliation et affilier d&apos;autres églises à votre réseau, vous devez souscrire à un abonnement Siège actif : <strong>50 $ par mois</strong> ou <strong>100 $ par an</strong>. Chaque paroisse affiliée paiera ensuite ses frais de 30 $ / an pour rejoindre votre réseau.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-amber-500/20">
            <Button
              className="bg-primary hover:bg-primary/90 text-white font-bold gap-2 text-xs flex-1"
              disabled={paying}
              onClick={() => handlePayHQ('annual')}
            >
              <Sparkles className="w-4 h-4" /> Activer l&apos;affiliation (100 $ / an - Recommandé)
            </Button>
            <Button
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/10 font-semibold gap-2 text-xs flex-1"
              disabled={paying}
              onClick={() => handlePayHQ('monthly')}
            >
              Activer l&apos;affiliation (50 $ / mois)
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="border-primary/30 shadow-sm bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Lien d&apos;Affiliation pour Nouvelles Églises
            </CardTitle>
            <CardDescription>
              Partagez ce lien au pasteur ou secrétaire d&apos;une nouvelle extension pour qu&apos;il enregistre sa paroisse dans votre réseau (30 $ / an).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                readOnly
                value={affiliationUrl}
                className="font-mono text-xs bg-background"
                placeholder="Génération du lien..."
              />
              <div className="flex gap-2 shrink-0">
                <Button onClick={handleCopyLink} variant="default" className="gap-1.5 text-xs">
                  <Copy className="w-3.5 h-3.5" /> Copier
                </Button>
                <Button onClick={handleShareWhatsapp} variant="outline" className="gap-1.5 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-50">
                  <Share2 className="w-3.5 h-3.5" /> WhatsApp
                </Button>
                <Button onClick={handleRegenerateCode} variant="ghost" size="icon" title="Régénérer le code">
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Code officiel du réseau : <strong className="font-mono text-foreground">{affiliationCode}</strong>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Affiliates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paroisses & Communautés Rattachées</CardTitle>
          <CardDescription>
            Liste des églises créées via votre affiliation avec leur statut d'abonnement.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paroisse</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-center">Membres</TableHead>
                <TableHead className="text-center">Cartes</TableHead>
                <TableHead>Statut Licence</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucune église affiliée pour l'instant. Partagez votre lien d'affiliation ci-dessus pour ajouter votre première paroisse.
                  </TableCell>
                </TableRow>
              ) : (
                affiliates.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">
                      {branch.name}
                      <div className="text-xs text-muted-foreground">{branch.email}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {branch.city}, {branch.country}
                    </TableCell>
                    <TableCell className="text-xs">
                      {branch.adminUser ? `${branch.adminUser.firstName} ${branch.adminUser.lastName}` : 'Non assigné'}
                      {branch.adminUser?.phone && (
                        <div className="text-muted-foreground">{branch.adminUser.phone}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold">{branch.memberCount}</TableCell>
                    <TableCell className="text-center font-bold">{branch.cardCount}</TableCell>
                    <TableCell>
                      {branch.isExpired ? (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertTriangle className="w-3 h-3" /> Expiré
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] gap-1">
                          <ShieldCheck className="w-3 h-3" /> Actif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {branch.isExpired ? (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 gap-1"
                          onClick={() => {
                            setSelectedBranch(branch)
                            setRenewModalOpen(true)
                          }}
                        >
                          Renouveler (30 $)
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">À jour</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de renouvellement par le Siège */}
      <Dialog open={renewModalOpen} onOpenChange={setRenewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renouveler l'abonnement de la paroisse</DialogTitle>
            <DialogDescription>
              En tant qu'église mère, vous pouvez régler les 30 $ / an pour débloquer immédiatement l'accès de votre extension.
            </DialogDescription>
          </DialogHeader>
          {selectedBranch && (
            <div className="space-y-4 py-2">
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <div><strong>Paroisse :</strong> {selectedBranch.name}</div>
                <div><strong>Ville :</strong> {selectedBranch.city}, {selectedBranch.country}</div>
                <div><strong>Montant :</strong> 30 $ USD (1 an d'accès complet)</div>
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500 gap-2"
                disabled={paying}
                onClick={handlePayBranchRenewal}
              >
                <RefreshCw className={`w-4 h-4 ${paying ? 'animate-spin' : ''}`} />
                Payer le renouvellement (30 $)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
