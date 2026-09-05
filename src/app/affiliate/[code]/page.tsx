'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Network, Building2, User, Lock, CheckCircle2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { APP_VERSION, CREATOR } from '@/lib/constants'
import Image from 'next/image'

interface ParentChurchInfo {
  id: string
  name: string
  logo?: string
  city?: string
  country?: string
}

export default function AffiliateJoinPage() {
  const params = useParams<{ code: string }>()
  const code = (params?.code || '') as string
  const router = useRouter()

  const [parentChurch, setParentChurch] = useState<ParentChurchInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [createdAdminEmail, setCreatedAdminEmail] = useState('')

  const [form, setForm] = useState({
    churchName: '',
    address: '',
    city: '',
    province: '',
    country: 'RDC',
    currency: 'USD',
    churchEmail: '',
    churchPhone: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: '',
  })

  useEffect(() => {
    async function verifyCode() {
      if (!code) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/public/affiliate/register?code=${encodeURIComponent(code)}`)
        if (res.ok) {
          const data = await res.json()
          setParentChurch(data.parentChurch)
        } else {
          toast.error('Code d’affiliation invalide ou expiré')
        }
      } catch {
        toast.error('Erreur de connexion')
      } finally {
        setLoading(false)
      }
    }
    verifyCode()
  }, [code])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.churchName || !form.adminFirstName || !form.adminLastName || !form.adminEmail || !form.adminPassword) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/affiliate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          ...form,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.paymentUrl) {
          toast.success('Compte créé ! Redirection vers le paiement de 30 $ USD...')
          window.location.href = data.paymentUrl
          return
        }
        setCreatedAdminEmail(data.user?.email || form.adminEmail)
        setSuccess(true)
        toast.success('Paroisse affiliée créée avec succès !')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors de la création de la paroisse')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!parentChurch && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-white">
        <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-center p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold">Lien d'affiliation invalide</h1>
          <p className="text-sm text-slate-400">
            Ce code d'affiliation n'existe pas ou a été révoqué par l'église mère. Veuillez contacter le Siège de votre communauté.
          </p>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white">
        <Card className="max-w-md w-full bg-slate-900/90 border-emerald-500/30 text-center p-8 space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Bienvenue dans le Réseau !</h1>
            <p className="text-sm text-slate-300">
              Votre paroisse <strong className="text-white">{form.churchName}</strong> a bien été enregistrée et rattachée à <strong className="text-white">{parentChurch?.name}</strong>.
            </p>
          </div>
          <div className="bg-slate-800/80 p-4 rounded-xl text-left text-xs space-y-1 text-slate-300 border border-slate-700">
            <div>• <strong>Identifiant administrateur :</strong> {createdAdminEmail}</div>
            <div>• <strong>Statut :</strong> Tous les modules débloqués</div>
            <div>• <strong>Cartes de membres :</strong> Prêtes à l'achat à tout moment (10 $ / unité)</div>
          </div>
          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2"
            onClick={() => router.push('/')}
          >
            Se connecter à l'application <ArrowRight className="w-4 h-4" />
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-white py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <Network className="w-3.5 h-3.5" /> Réseau Officiel d'Églises
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Inscription de votre Paroisse Affiliée
          </h1>
          <p className="text-sm text-slate-400">
            Rattachée au Siège : <strong className="text-white">{parentChurch?.name}</strong>
          </p>
        </div>

        {/* Form Card */}
        <Card className="bg-slate-900/90 border-slate-800 text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">Formulaire d'enregistrement de l'extension</CardTitle>
            <CardDescription className="text-slate-400">
              Remplissez les informations de votre église locale et créez vos accès administrateur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1: Informations de la Paroisse */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Building2 className="w-4 h-4" /> 1. Informations de la Paroisse
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="churchName">Nom de l'église locale / Paroisse *</Label>
                  <Input
                    id="churchName"
                    required
                    placeholder="Ex: Église La Grâce - Extension Lubumbashi"
                    className="bg-slate-800 border-slate-700 text-white"
                    value={form.churchName}
                    onChange={(e) => setForm({ ...form, churchName: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville *</Label>
                    <Input
                      id="city"
                      required
                      placeholder="Ex: Lubumbashi"
                      className="bg-slate-800 border-slate-700 text-white"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="province">Province / Région *</Label>
                    <Input
                      id="province"
                      required
                      placeholder="Ex: Haut-Katanga"
                      className="bg-slate-800 border-slate-700 text-white"
                      value={form.province}
                      onChange={(e) => setForm({ ...form, province: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Pays *</Label>
                    <Input
                      id="country"
                      required
                      placeholder="Ex: RDC, France, Côte d'Ivoire..."
                      className="bg-slate-800 border-slate-700 text-white"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Devise principale *</Label>
                    <Select
                      value={form.currency}
                      onValueChange={(val) => setForm({ ...form, currency: val })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Devise" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="CDF">Franc Congolais (FC)</SelectItem>
                        <SelectItem value="EUR">Euro (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse du lieu de culte *</Label>
                  <Input
                    id="address"
                    required
                    placeholder="Ex: 12 Avenue des Martyrs, Quartier Golf"
                    className="bg-slate-800 border-slate-700 text-white"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="churchEmail">Email officiel de l'église *</Label>
                    <Input
                      id="churchEmail"
                      type="email"
                      required
                      placeholder="contact.lubumbashi@eglise.org"
                      className="bg-slate-800 border-slate-700 text-white"
                      value={form.churchEmail}
                      onChange={(e) => setForm({ ...form, churchEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="churchPhone">Téléphone de l'église</Label>
                    <Input
                      id="churchPhone"
                      placeholder="+243..."
                      className="bg-slate-800 border-slate-700 text-white"
                      value={form.churchPhone}
                      onChange={(e) => setForm({ ...form, churchPhone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Administrateur Principal Local */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2 border-b border-slate-800 pb-2">
                  <User className="w-4 h-4" /> 2. Administrateur Principal (Pasteur / Secrétaire)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminFirstName">Prénom *</Label>
                    <Input
                      id="adminFirstName"
                      required
                      placeholder="Prénom"
                      className="bg-slate-800 border-slate-700 text-white"
                      value={form.adminFirstName}
                      onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminLastName">Nom *</Label>
                    <Input
                      id="adminLastName"
                      required
                      placeholder="Nom de famille"
                      className="bg-slate-800 border-slate-700 text-white"
                      value={form.adminLastName}
                      onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">Email de connexion de l'admin *</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      required
                      placeholder="pasteur@eglise.org"
                      className="bg-slate-800 border-slate-700 text-white"
                      value={form.adminEmail}
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Mot de passe secret *</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      required
                      placeholder="Au moins 6 caractères"
                      className="bg-slate-800 border-slate-700 text-white"
                      value={form.adminPassword}
                      onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Frais d'affiliation obligatoires */}
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span>Frais d'affiliation annuelle</span>
                  <span className="text-primary text-base font-black">30 $ USD / an</span>
                </div>
                <p className="text-slate-300">
                  L'adhésion au réseau donne un accès illimité à tous les modules de l'application MyChurch pendant 1 an. Dès validation, vous serez redirigé vers GeniusPay pour régler les 30 $ en toute sécurité (Mobile Money ou Carte bancaire).
                </p>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-sm shadow-lg shadow-emerald-600/20"
                disabled={submitting}
              >
                {submitting ? 'Préparation du paiement...' : 'Payer 30 $ USD et activer l’affiliation'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p>{CREATOR} • Version {APP_VERSION}</p>
        </div>
      </div>
    </div>
  )
}
