'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CreditCard,
  Download,
  Printer,
  Share2,
  QrCode,
  Check,
  RotateCcw,
  Copy,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'

interface Member {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  department: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  photo: string | null
}

interface CardData {
  id: string
  cardNumber: string
  qrCode: string
  isPaid: boolean
  createdAt: string
  member: Member
}

interface ExistingCard extends CardData {}

export function MemberCardsPage() {
  const { auth } = useAppStore()
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isFlipping, setIsFlipping] = useState(false)
  const [existingCards, setExistingCards] = useState<ExistingCard[]>([])
  const [cardsLoading, setCardsLoading] = useState(true)

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId),
    [members, selectedMemberId],
  )

  const memberName = selectedMember
    ? `${selectedMember.firstName} ${selectedMember.lastName}`
    : ''

  // Get church info from auth store
  const churchName = auth.churchName || 'MYCHURCH'

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setCardsLoading(true)
      try {
        const [membersRes, cardsRes] = await Promise.all([
          fetch('/api/members?status=active&limit=200', {
            headers: { Authorization: `Bearer ${auth.token}` },
          }),
          fetch('/api/cards?limit=50', {
            headers: { Authorization: `Bearer ${auth.token}` },
          }),
        ])

        if (membersRes.ok) {
          const data = await membersRes.json()
          setMembers(data.members || data.data || [])
        }
        if (cardsRes.ok) {
          const data = await cardsRes.json()
          setExistingCards(data.cards || data.data || [])
        }
      } catch {
        toast.error('Erreur de chargement des données')
      } finally {
        setLoading(false)
        setCardsLoading(false)
      }
    }
    if (auth.token) {
      loadData()
    }
  }, [auth.token, cardData])


  function handleMemberChange(memberId: string) {
    setSelectedMemberId(memberId)
    setCardData(null)
    setIsFlipped(false)
  }

  async function handleGenerateCard() {
    if (!selectedMemberId) return
    setGenerating(true)
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId: selectedMemberId }),
      })
      if (res.ok) {
        const data = await res.json()
        setCardData(data.card)
        toast.success('Carte générée avec succès !')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur de génération')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setGenerating(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  function handleDownload() {
    // Print with the card visible is the most reliable cross-platform way;
    // this triggers the print/save dialog on mobile & desktop.
    handlePrint()
  }

  function handleShare() {
    if (cardData) {
      const shareText = `Carte de membre MYCHURCH\n${memberName}\nN° ${cardData.cardNumber}\n${churchName}\n${new Date(cardData.createdAt).toLocaleDateString('fr-FR')}`

      if (navigator.share) {
        navigator.share({
          title: `Carte - ${memberName}`,
          text: shareText,
        }).catch(() => {
          // User cancelled - fall through to clipboard
          copyToClipboard(shareText)
        })
      } else {
        copyToClipboard(shareText)
      }
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Informations copiées dans le presse-papiers !')
    } catch {
      toast.error('Impossible de copier')
    }
  }

  function handleFlip() {
    setIsFlipping(true)
    setIsFlipped(!isFlipped)
    setTimeout(() => setIsFlipping(false), 700)
  }

  function formatCardNumber(num: string): string {
    // Display as MC-XXXXXXXX format
    const parts = num.split('-')
    if (parts.length >= 3) {
      return `MC-${parts[1]}${parts[2]}`
    }
    return num
  }

  const [activeTab, setActiveTab] = useState<'generate' | 'list'>('generate')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cartes de Membre</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Générez gratuitement une carte de membre pour chaque membre de votre église.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border gap-2">
        <Button
          variant={activeTab === 'generate' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('generate')}
          className="rounded-b-none border-b-2 border-transparent data-[active=true]:border-primary"
        >
          <CreditCard className="h-4 w-4 mr-2" /> Générer une carte
        </Button>
        <Button
          variant={activeTab === 'list' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('list')}
          className="rounded-b-none border-b-2 border-transparent data-[active=true]:border-primary"
        >
          <Printer className="h-4 w-4 mr-2" /> Afficher les cartes générées
          {existingCards.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">{existingCards.length}</Badge>
          )}
        </Button>
      </div>

      {activeTab === 'generate' ? (
        <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Selection & Generation */}
        <div className="space-y-4">
          {/* Member Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sélectionner un membre</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : (
                <Select value={selectedMemberId} onValueChange={handleMemberChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un membre..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                        {m.department ? ` — ${m.department}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Generate & Actions */}
          <div className="space-y-2">
            <Button
              className="w-full gap-2 h-11"
              disabled={!selectedMemberId || generating}
              onClick={handleGenerateCard}
            >
              {generating ? (
                <>
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Générer la carte
                </>
              )}
            </Button>
            {cardData && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Imprimer
                </Button>
                <Button variant="outline" className="flex-1 gap-2" onClick={handleShare}>
                  <Copy className="h-4 w-4" />
                  Partager
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Card Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Aperçu de la carte</CardTitle>
                {cardData && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground"
                    onClick={handleFlip}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retourner
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {cardData && selectedMember ? (
                <div className="member-card-preview">
                  {/* Flip container */}
                  <div
                    className="relative cursor-pointer"
                    style={{ perspective: '1000px' }}
                    onClick={handleFlip}
                  >
                    <div
                      className="relative"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: isFlipping
                          ? '0 30px 60px -15px oklch(0 0 0 / 0.35)'
                          : '0 20px 40px -10px oklch(0 0 0 / 0.2)',
                      }}
                    >
                      {/* FRONT of card */}
                      <div
                        className="w-full aspect-[1.586/1] rounded-2xl overflow-hidden"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <div className="relative h-full bg-gradient-to-br from-blue-600 via-blue-800 to-blue-950 p-6 text-white flex flex-col justify-between">
                          {/* Card background pattern - subtle diagonal lines */}
                          <div
                            className="absolute inset-0 opacity-[0.04]"
                            style={{
                              backgroundImage: `repeating-linear-gradient(
                                45deg,
                                transparent,
                                transparent 8px,
                                rgba(255,255,255,0.5) 8px,
                                rgba(255,255,255,0.5) 9px
                              )`,
                            }}
                          />

                          {/* Decorative circles */}
                          <div className="absolute inset-0 overflow-hidden">
                            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/5" />
                            <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/5" />
                            <div className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full bg-white/[0.03]" />
                          </div>

                          {/* Shimmer/gloss sweep animation */}
                          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                            <div
                              className="absolute inset-0 animate-shimmer-sweep"
                              style={{
                                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 55%, transparent 60%)',
                                width: '60%',
                                left: '-60%',
                              }}
                            />
                          </div>

                          {/* Top: Logo + Church name */}
                          <div className="relative z-10 flex flex-col items-center gap-2">
                            <img
                              src={auth.churchLogo || '/logo-mychurch.png'}
                              alt="Church Logo"
                              className="w-10 h-10 object-contain drop-shadow"
                            />
                            <span className="text-xs font-bold tracking-[0.3em] uppercase text-white/90">
                              {churchName}
                            </span>
                          </div>

                          {/* Middle: Photo + Name */}
                          <div className="relative z-10 flex flex-col items-center gap-2.5">
                            <div className="h-20 w-20 rounded-full border-[3px] border-white/30 overflow-hidden shadow-lg">
                              {selectedMember.photo ? (
                                <img
                                  src={selectedMember.photo}
                                  alt={memberName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-white/15 flex items-center justify-center text-2xl font-bold text-white/80">
                                  {selectedMember.firstName[0]}
                                  {selectedMember.lastName[0]}
                                </div>
                              )}
                            </div>
                            <p className="text-xl font-bold tracking-wide text-center leading-tight">
                              {memberName}
                            </p>
                            <p className="text-xs font-mono tracking-[0.2em] text-white/60 uppercase">
                              {formatCardNumber(cardData.cardNumber)}
                            </p>
                          </div>

                          {/* Bottom: MEMBER CARD */}
                          <div className="relative z-10 text-center">
                            <p className="text-[10px] font-bold tracking-[0.35em] text-white/40 uppercase">
                              Member Card
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* BACK of card */}
                      <div
                        className="w-full aspect-[1.586/1] rounded-2xl overflow-hidden absolute inset-0"
                        style={{
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}
                      >
                        <div className="relative h-full bg-white flex flex-col justify-between p-6">
                          {/* Card background pattern on back */}
                          <div
                            className="absolute inset-0 opacity-[0.015] pointer-events-none"
                            style={{
                              backgroundImage: `repeating-linear-gradient(
                                45deg,
                                transparent,
                                transparent 12px,
                                rgba(0,0,0,0.8) 12px,
                                rgba(0,0,0,0.8) 13px
                              )`,
                            }}
                          />

                          {/* Magnetic stripe */}
                          <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900" />

                          {/* Church info */}
                          <div className="mt-16 flex items-center gap-3">
                            <img
                              src={auth.churchLogo || '/logo-mychurch.png'}
                              alt="Church Logo"
                              className="h-10 w-10 object-contain rounded shadow-sm"
                            />
                            <div>
                              <p className="text-sm font-bold text-gray-900 tracking-wide">
                                {churchName}
                              </p>
                              <p className="text-xs text-gray-500">Kinshasa, RDC</p>
                            </div>
                          </div>

                          {/* Member contact details on back */}
                          <div className="space-y-1.5 mt-3">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-wider text-gray-400">Email</p>
                                <p className="text-xs text-gray-700 font-medium truncate">{selectedMember.email || '—'}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-wider text-gray-400">Téléphone</p>
                                <p className="text-xs text-gray-700 font-medium truncate">{selectedMember.phone || '—'}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-wider text-gray-400">Département</p>
                                <p className="text-xs text-gray-700 font-medium truncate">{selectedMember.department || '—'}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-wider text-gray-400">Urgence</p>
                                <p className="text-xs text-gray-700 font-medium truncate">
                                  {[selectedMember.emergencyContactName, selectedMember.emergencyContactPhone]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* QR Code + Creator */}
                          <div className="flex items-end justify-between mt-auto pt-3">
                            {/* QR Code */}
                            <div className="flex items-center gap-3">
                              <div className="h-14 w-14 rounded-lg border-2 border-gray-200 bg-gray-50 flex items-center justify-center">
                                {cardData.qrCode ? (
                                  <img
                                    src={cardData.qrCode}
                                    alt="QR Code"
                                    className="h-full w-full object-contain rounded-lg"
                                  />
                                ) : (
                                  <QrCode className="h-7 w-7 text-gray-300" />
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] font-mono text-gray-400 tracking-wider">
                                  {formatCardNumber(cardData.cardNumber)}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {new Date(cardData.createdAt).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                            </div>

                            {/* Creator signature */}
                            <p className="text-[9px] text-gray-300 italic text-right leading-tight max-w-[120px]">
                              Created by Henock Aduma
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Click hint */}
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Cliquez sur la carte pour la retourner (Aperçu 3D)
                  </p>
                </div>
              ) : (
                <div className="aspect-[1.586/1] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <CreditCard className="h-12 w-12 opacity-30" />
                  <p className="text-sm">
                    Sélectionnez un membre et cliquez sur &quot;Générer la carte&quot;
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guide & Directives d'impression */}
          <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Printer className="h-4 w-4" />
                Directives d&apos;impression (Recto &amp; Verso en couleur)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p className="leading-relaxed">
                Pour obtenir un résultat d&apos;impression professionnel du Recto et du Verso :
              </p>
              <ol className="list-decimal list-inside space-y-1.5 font-medium text-foreground">
                <li>Cliquez sur le bouton <strong>Imprimer</strong> ci-dessus.</li>
                <li>Dans les paramètres d&apos;impression de votre navigateur, cochez <strong>« Graphiques d&apos;arrière-plan »</strong> (Background graphics) afin de conserver les couleurs et dégradés.</li>
                <li>Définissez les <strong>Marges</strong> sur <em>« Aucune »</em> ou <em>« Par défaut »</em>.</li>
                <li>Pour une carte PVC ou plastifiée, imprimez le Recto et le Verso puis découpez le long des pointillés.</li>
              </ol>
            </CardContent>
          </Card>
        </div>
        </div>
      ) : (
        /* TAB 2: Cartes déjà générées */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Toutes les cartes générées ({existingCards.length})</h2>
            <Button size="sm" onClick={() => setActiveTab('generate')}>
              <CreditCard className="h-4 w-4 mr-1.5" /> Générer une nouvelle carte
            </Button>
          </div>
          {cardsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          ) : existingCards.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl space-y-3">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Aucune carte générée pour le moment.</p>
              <Button size="sm" variant="outline" onClick={() => setActiveTab('generate')}>
                Générer la première carte
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {existingCards.map((card) => (
                <Card
                  key={card.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    if (card.member) {
                      setSelectedMemberId(card.member.id)
                      setCardData(card)
                      setActiveTab('generate')
                    }
                  }}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {card.member?.photo ? (
                        <img src={card.member.photo} alt="Photo" className="h-full w-full object-cover rounded-lg" />
                      ) : (
                        <CreditCard className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {card.member
                          ? `${card.member.firstName} ${card.member.lastName}`
                          : 'Membre'}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {formatCardNumber(card.cardNumber)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(card.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Badge variant={card.isPaid ? 'default' : 'outline'}>
                      {card.isPaid ? 'Fait' : 'Non fait'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AREA PRINTABLE DEDICATED TO WINDOW.PRINT() */}
      {cardData && selectedMember && (
        <div id="member-card-print-area" className="p-8 bg-white text-black font-sans">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center pb-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">{churchName}</h2>
              <p className="text-sm text-gray-500">Carte de Membre Officielle — Impression Recto / Verso</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start justify-center">
              {/* RECTO / FRONT PRINT */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 text-center">FACE 1 — RECTO</p>
                <div className="w-[336px] h-[212px] mx-auto rounded-2xl overflow-hidden shadow-md border border-gray-300 relative bg-gradient-to-br from-blue-600 via-blue-800 to-blue-950 p-5 text-white flex flex-col justify-between"
                  style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <img src={auth.churchLogo || '/logo-mychurch.png'} alt="Logo" className="w-8 h-8 object-contain" />
                    <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/90">
                      {churchName}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="h-16 w-16 rounded-full border-2 border-white/40 overflow-hidden bg-white/10 flex items-center justify-center">
                      {selectedMember.photo ? (
                        <img src={selectedMember.photo} alt={memberName} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold">
                          {selectedMember.firstName[0]}{selectedMember.lastName[0]}
                        </span>
                      )}
                    </div>
                    <p className="text-base font-bold tracking-wide text-center leading-tight">
                      {memberName}
                    </p>
                    <p className="text-[10px] font-mono tracking-[0.15em] text-white/70">
                      {formatCardNumber(cardData.cardNumber)}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-[9px] font-bold tracking-[0.3em] text-white/50 uppercase">
                      MEMBER CARD
                    </p>
                  </div>
                </div>
              </div>

              {/* VERSO / BACK PRINT */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 text-center">FACE 2 — VERSO</p>
                <div className="w-[336px] h-[212px] mx-auto rounded-2xl overflow-hidden shadow-md border border-gray-300 relative bg-white p-5 text-gray-900 flex flex-col justify-between"
                  style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                >
                  <div className="absolute top-0 left-0 right-0 h-10 bg-gray-900" />

                  <div className="mt-10 flex items-center gap-2.5">
                    <img src={auth.churchLogo || '/logo-mychurch.png'} alt="Logo" className="h-8 w-8 object-contain" />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{churchName}</p>
                      <p className="text-[9px] text-gray-500">Carte de membre officielle</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] my-1">
                    <div>
                      <span className="text-gray-400 block uppercase">Email</span>
                      <span className="font-semibold text-gray-800 truncate block">{selectedMember.email || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase">Téléphone</span>
                      <span className="font-semibold text-gray-800 truncate block">{selectedMember.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase">Département</span>
                      <span className="font-semibold text-gray-800 truncate block">{selectedMember.department || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase">Urgence</span>
                      <span className="font-semibold text-gray-800 truncate block">
                        {[selectedMember.emergencyContactName, selectedMember.emergencyContactPhone].filter(Boolean).join(' ') || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-end justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 border border-gray-200 rounded p-0.5">
                        {cardData.qrCode ? (
                          <img src={cardData.qrCode} alt="QR Code" className="h-full w-full object-contain" />
                        ) : null}
                      </div>
                      <div>
                        <p className="text-[9px] font-mono text-gray-500">{formatCardNumber(cardData.cardNumber)}</p>
                        <p className="text-[8px] text-gray-400">{new Date(cardData.createdAt).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                    <span className="text-[8px] text-gray-400 italic">Created by Henock Aduma</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center pt-6 text-[10px] text-gray-400 border-t border-gray-200">
              Imprimé depuis MYCHURCH App • {new Date().toLocaleDateString('fr-FR')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}