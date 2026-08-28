'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import {
  Camera, Upload, CheckCircle, UserPlus, CreditCard, Image as ImageIcon,
  CheckCircle2, Sparkles,
} from 'lucide-react'
import { CREATOR } from '@/lib/constants'
import { useParams } from 'next/navigation'
import Image from 'next/image'

interface ChurchInfo {
  id: string
  name: string
  logo: string | null
  address: string | null
  city: string | null
}

interface MemberPreview {
  firstName: string
  lastName: string
  photo: string | null
  email: string | null
  phone: string | null
  department: string | null
  type: string
}

const emptyForm = {
  firstName: '', lastName: '', type: 'member' as 'member' | 'personnel',
  phone: '', email: '', address: '', department: '', function: '',
  emergencyContactName: '', emergencyContactPhone: '',
  photo: null as string | null,
}

export default function JoinPage() {
  const params = useParams<{ slug: string }>()
  const slug = (params?.slug || '') as string

  const [church, setChurch] = useState<ChurchInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [cardFlipped, setCardFlipped] = useState(false)

  useEffect(() => {
    async function fetchChurch() {
      if (!slug) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/public/church?slug=${encodeURIComponent(slug)}`)
        if (res.ok) {
          const data = await res.json()
          setChurch(data.church)
        } else {
          toast.error('Lien d\'inscription invalide')
        }
      } catch {
        toast.error('Erreur de connexion')
      } finally {
        setLoading(false)
      }
    }
    fetchChurch()
  }, [slug])

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/public/upload?slug=${encodeURIComponent(slug)}&folder=members`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Erreur d'envoi de la photo")
      }
      const data = await res.json()
      setForm((f) => ({ ...f, photo: data.url }))
      toast.success('Photo téléchargée')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de téléchargement')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async () => {
    const required: [string, string][] = [
      ['firstName', 'Le prénom est requis'],
      ['lastName', 'Le nom est requis'],
      ['phone', 'Le téléphone est requis'],
      ['address', "L'adresse est requise"],
      ['department', 'Le département est requis'],
      ['function', 'La fonction est requise'],
      ['emergencyContactName', "Le nom du contact d'urgence est requis"],
      ['emergencyContactPhone', "Le téléphone d'urgence est requis"],
    ]
    for (const [key, msg] of required) {
      if (!(form as any)[key]?.trim()) {
        toast.error(msg)
        return
      }
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...form }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const err = await res.json()
        const details = err.details?.[0]?.message
        toast.error(details || err.error || 'Erreur lors de l\'inscription')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const preview: MemberPreview = {
    firstName: form.firstName || 'Prénom',
    lastName: form.lastName || 'Nom',
    photo: form.photo,
    email: form.email || null,
    phone: form.phone || null,
    department: form.department || null,
    type: form.type,
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-950">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-10 w-80 max-w-full" />
      </div>
    )
  }

  if (!church) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
        <h1 className="text-2xl font-bold text-gray-900">Lien invalide</h1>
        <p className="text-muted-foreground mt-2">
          Ce lien d'inscription n'existe pas ou a été modifié. Contactez votre église.
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-emerald-50 to-white">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-gray-900">
            Inscription réussie !
          </h1>
          <p className="mt-3 text-muted-foreground">
            Merci <span className="font-semibold text-gray-900">{form.firstName}</span>. Votre
            demande a bien été enregistrée auprès de <span className="font-semibold text-gray-900">{church.name}</span>.
          </p>
          <div className="mt-4 rounded-lg bg-white border p-4 text-sm text-gray-700">
            Venez à l&apos;église pour récupérer votre carte de membre.
          </div>
          <p className="mt-6 text-xs text-muted-foreground">{CREATOR}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white overflow-hidden shadow-lg ring-2 ring-white/30 shrink-0">
            <img
              src={church.logo || '/logo-mychurch.png'}
              alt={church.name}
              className="h-full w-full object-contain p-1"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo-mychurch.png' }}
            />
          </div>
          <div>
            <h1 className="text-xl font-bold">{church.name}</h1>
            <p className="text-sm text-white/70">Inscription en ligne</p>
          </div>
        </div>

        {/* 3D Recto / Verso Card preview */}
        <div className="mb-6">
          <div
            className="relative cursor-pointer"
            style={{ perspective: '1000px' }}
            onClick={() => setCardFlipped(!cardFlipped)}
          >
            <div
              className="relative aspect-[1.586/1] w-full"
              style={{
                transformStyle: 'preserve-3d',
                transform: cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {/* RECTO */}
              <div
                className="w-full h-full rounded-2xl overflow-hidden shadow-xl border border-white/20 absolute inset-0"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="relative h-full bg-gradient-to-br from-blue-600 via-blue-800 to-blue-950 p-5 text-white flex flex-col justify-between">
                  <div className="relative z-10 flex flex-col items-center gap-1">
                    <img
                      src={church.logo || '/logo-mychurch.png'}
                      alt=""
                      className="w-8 h-8 object-contain drop-shadow"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/logo-mychurch.png' }}
                    />
                    <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/90">
                      {church.name}
                    </span>
                  </div>

                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="h-16 w-16 rounded-full border-[3px] border-white/40 overflow-hidden bg-white/15 flex items-center justify-center shadow-md">
                      {preview.photo ? (
                        <img src={preview.photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-white/90">
                          {preview.firstName[0] || ''}{preview.lastName[0] || ''}
                        </span>
                      )}
                    </div>
                    <p className="text-base font-bold tracking-wide text-center leading-tight">
                      {preview.firstName} {preview.lastName}
                    </p>
                    <p className="text-[10px] font-mono tracking-[0.15em] text-white/60 uppercase">
                      MC-Nouveau Membre
                    </p>
                  </div>

                  <div className="relative z-10 text-center">
                    <p className="text-[9px] font-bold tracking-[0.3em] text-white/40 uppercase">
                      MEMBER CARD • RECTO
                    </p>
                  </div>
                </div>
              </div>

              {/* VERSO */}
              <div
                className="w-full h-full rounded-2xl overflow-hidden shadow-xl border border-gray-200 absolute inset-0 bg-white text-gray-900"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div className="relative h-full flex flex-col justify-between p-5">
                  <div className="absolute top-0 left-0 right-0 h-10 bg-gray-900" />

                  <div className="mt-8 flex items-center gap-2.5">
                    <img
                      src={church.logo || '/logo-mychurch.png'}
                      alt=""
                      className="h-7 w-7 object-contain rounded"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/logo-mychurch.png' }}
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{church.name}</p>
                      <p className="text-[9px] text-gray-500">Carte officielle du membre</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] my-1">
                    <div>
                      <span className="text-gray-400 block uppercase">Téléphone</span>
                      <span className="font-medium text-gray-800 truncate block">{preview.phone || 'Non renseigné'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase">Email</span>
                      <span className="font-medium text-gray-800 truncate block">{preview.email || 'Non renseigné'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase">Département</span>
                      <span className="font-medium text-gray-800 truncate block">{preview.department || 'Membre'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase">Statut</span>
                      <span className="font-medium text-emerald-600 truncate block">En attente de validation</span>
                    </div>
                  </div>

                  <div className="flex items-end justify-between pt-1 border-t border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <div className="h-8 w-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-gray-400" />
                      </div>
                      <span className="text-[8px] font-mono text-gray-400">QR Code au retrait</span>
                    </div>
                    <span className="text-[8px] text-gray-400 italic">MYCHURCH App</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-white/70 mt-2">
            💡 Cliquez sur la carte pour voir le <strong>{cardFlipped ? 'Recto' : 'Verso'}</strong>
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-white text-gray-900 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold">Vos informations</h2>
          </div>

          {/* Photo */}
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 border-2 border-blue-100">
              {form.photo ? (
                <img src={form.photo} alt="Photo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground capitalize">{church.name} :: photo de profil ou en direct</Label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-blue-600 hover:underline">
                <Camera className="h-4 w-4" />
                {form.photo ? 'Changer la photo' : 'Ajouter une photo'}
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhoto} />
              </label>
              {uploading && <p className="text-xs text-muted-foreground">Téléchargement...</p>}
            </div>
          </div>

          {/* Type */}
          <RadioGroup
            value={form.type}
            onValueChange={(v) => setForm({ ...form, type: v as 'member' | 'personnel' })}
            className="grid grid-cols-2 gap-3"
          >
            <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${form.type === 'member' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
              <RadioGroupItem value="member" id="p-type-member" />
              <span className="text-sm font-medium">Membre</span>
            </label>
            <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${form.type === 'personnel' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
              <RadioGroupItem value="personnel" id="p-type-personnel" />
              <span className="text-sm font-medium">Personnel</span>
            </label>
          </RadioGroup>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Prénom *</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Prénom" className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nom *</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Nom" className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Téléphone *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+243 ..." className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.com" className="h-10" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Adresse *</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Adresse complète" className="h-10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{form.type === 'personnel' ? 'Fonction *' : 'Département *'}</Label>
              <Input
                value={form.type === 'personnel' ? form.function : form.department}
                onChange={(e) => setForm(
                  form.type === 'personnel' ? { ...form, function: e.target.value } : { ...form, department: e.target.value },
                )}
                placeholder={form.type === 'personnel' ? 'Fonction' : 'Département'}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{form.type === 'personnel' ? 'Département *' : 'Fonction *'}</Label>
              <Input
                value={form.type === 'personnel' ? form.department : form.function}
                onChange={(e) => setForm(
                  form.type === 'personnel' ? { ...form, department: e.target.value } : { ...form, function: e.target.value },
                )}
                placeholder={form.type === 'personnel' ? 'Département' : 'Fonction'}
                className="h-10"
              />
            </div>
          </div>

          {/* Emergency contact */}
          <div className="rounded-lg border bg-muted/10 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Contact en cas d'urgence *</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom *</Label>
                <Input value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="Nom" className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Téléphone *</Label>
                <Input value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="+243 ..." className="h-10" />
              </div>
            </div>
          </div>

          <Button className="w-full h-11 gap-2" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Inscription en cours...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                S'inscrire
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-white/50 mt-6">{CREATOR}</p>
      </div>
    </div>
  )
}