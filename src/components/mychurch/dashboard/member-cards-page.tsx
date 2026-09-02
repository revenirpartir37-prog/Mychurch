'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  CreditCard,
  Download,
  Printer,
  QrCode,
  RotateCcw,
  ShoppingCart,
  Minus,
  Plus,
  Loader2,
  Check,
  AlertCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'

function formatUsd(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(amount)
}

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

interface CardCredit {
  remaining: number
  totalPurchased: number
  totalGenerated: number
}

interface PendingOrder {
  id: string
  quantity: number
  totalPriceUsd: number
  createdAt: string
}

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

  // Credit state
  const [credit, setCredit] = useState<CardCredit | null>(null)
  const [creditLoading, setCreditLoading] = useState(true)

  // Purchase dialog state
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [purchaseQuantity, setPurchaseQuantity] = useState(1)
  const [purchasing, setPurchasing] = useState(false)

  // Pending orders state
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId),
    [members, selectedMemberId],
  )

  const memberName = selectedMember
    ? `${selectedMember.firstName} ${selectedMember.lastName}`
    : ''

  const churchName = auth.churchName || 'MYCHURCH'

  const fetchCredit = useCallback(async () => {
    if (!auth.token) return
    try {
      const res = await authFetch('/api/cards/credit')
      if (res.ok) {
        const data = await res.json()
        setCredit(data)
      }
    } catch {
      // silent
    } finally {
      setCreditLoading(false)
    }
  }, [auth.token])

  const fetchPendingOrders = useCallback(async () => {
    if (!auth.token) return
    try {
      const res = await authFetch('/api/payments/pending-orders')
      if (res.ok) {
        const data = await res.json()
        setPendingOrders(data.orders || [])
      }
    } catch {
      // silent
    }
  }, [auth.token])

  const handleCancelOrder = useCallback(async (orderId: string) => {
    setCancellingId(orderId)
    try {
      const res = await authFetch('/api/payments/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId }),
      })
      if (res.ok) {
        toast.success('Commande annulée')
        setPendingOrders((prev) => prev.filter((o) => o.id !== orderId))
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur d'annulation")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setCancellingId(null)
    }
  }, [auth.token])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setCardsLoading(true)
      try {
        const [membersRes, cardsRes] = await Promise.all([
          authFetch('/api/members?status=active&limit=200'),
          authFetch('/api/cards?limit=50'),
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
      fetchCredit()
      fetchPendingOrders()
    }
  }, [auth.token, fetchCredit, fetchPendingOrders])

  // Handle payment success redirect
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get('payment')
    const orderId = params.get('order')

    if (paymentStatus === 'success' && orderId && auth.token) {
      toast.success('Paiement confirmé ! Vos cartes ont été créditées.')
      fetchCredit()
      fetchPendingOrders()
      // Clean URL
      window.history.replaceState({}, '', '/?view=member-cards')
    } else if (paymentStatus === 'error' && orderId) {
      toast.error('Le paiement a échoué. Veuillez réessayer.')
      window.history.replaceState({}, '', '/?view=member-cards')
    }
  }, [auth.token, fetchCredit, fetchPendingOrders])

  function handleMemberChange(memberId: string) {
    setSelectedMemberId(memberId)
    setCardData(null)
    setIsFlipped(false)
  }

  async function handleGenerateCard() {
    if (!selectedMemberId) return

    // Check credit first
    if (credit && credit.remaining <= 0) {
      setPurchaseOpen(true)
      return
    }

    setGenerating(true)
    try {
      const res = await authFetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId: selectedMemberId }),
      })
      if (res.ok) {
        const data = await res.json()
        setCardData(data.card)
        toast.success('Carte générée avec succès !')
        fetchCredit()
      } else {
        const data = await res.json()
        if (data.error === 'NO_CREDIT_REMAINING') {
          setPurchaseOpen(true)
        } else {
          toast.error(data.error || 'Erreur de génération')
        }
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setGenerating(false)
    }
  }

  async function handlePurchaseCards() {
    setPurchasing(true)
    try {
      const res = await authFetch('/api/payments/card-bundle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity: purchaseQuantity }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl
        }
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur de paiement")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setPurchasing(false)
    }
  }

  async function handleDownload() {
    if (!cardData || !selectedMember) return
    toast.info("Génération de l'image HD recto/verso en cours...")

    try {
      const canvas = document.createElement('canvas')
      const width = 1000
      const cardHeight = 630
      const gap = 40
      const padding = 50
      const totalHeight = padding * 2 + cardHeight * 2 + gap

      canvas.width = width
      canvas.height = totalHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, totalHeight)

      const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
      }

      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => resolve(img)
          img.src = src
        })
      }

      const cardWidth = 900
      const cardX = (width - cardWidth) / 2
      const frontY = padding
      const backY = padding + cardHeight + gap

      // RECTO / FRONT
      ctx.save()
      drawRoundRect(cardX, frontY, cardWidth, cardHeight, 32)
      ctx.clip()

      const grad = ctx.createLinearGradient(cardX, frontY, cardX + cardWidth, frontY + cardHeight)
      grad.addColorStop(0, '#1d4ed8')
      grad.addColorStop(0.5, '#1e40af')
      grad.addColorStop(1, '#0f172a')
      ctx.fillStyle = grad
      ctx.fillRect(cardX, frontY, cardWidth, cardHeight)

      const logoSrc = auth.churchLogo || '/logo-mychurch.png'
      const logoImg = await loadImage(logoSrc)
      if (logoImg.width) {
        ctx.drawImage(logoImg, cardX + cardWidth / 2 - 30, frontY + 30, 60, 60)
      }

      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(churchName.toUpperCase(), cardX + cardWidth / 2, frontY + 120)

      const photoX = cardX + cardWidth / 2
      const photoY = frontY + 230
      const photoR = 70

      ctx.save()
      ctx.beginPath()
      ctx.arc(photoX, photoY, photoR, 0, Math.PI * 2)
      ctx.closePath()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.lineWidth = 6
      ctx.stroke()
      ctx.clip()

      if (selectedMember.photo) {
        const memberImg = await loadImage(selectedMember.photo)
        if (memberImg.width) {
          ctx.drawImage(memberImg, photoX - photoR, photoY - photoR, photoR * 2, photoR * 2)
        }
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.fillRect(photoX - photoR, photoY - photoR, photoR * 2, photoR * 2)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 44px sans-serif'
        ctx.fillText(`${selectedMember.firstName[0]}${selectedMember.lastName[0]}`, photoX, photoY + 15)
      }
      ctx.restore()

      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 36px sans-serif'
      ctx.fillText(memberName, cardX + cardWidth / 2, frontY + 360)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.font = 'bold 22px monospace'
      ctx.fillText(formatCardNumber(cardData.cardNumber), cardX + cardWidth / 2, frontY + 410)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = 'bold 18px sans-serif'
      ctx.fillText('MEMBER CARD', cardX + cardWidth / 2, frontY + 540)
      ctx.restore()

      const lineY = frontY + cardHeight + gap / 2
      ctx.strokeStyle = '#CBD5E1'
      ctx.lineWidth = 2
      ctx.setLineDash([10, 10])
      ctx.beginPath()
      ctx.moveTo(cardX, lineY)
      ctx.lineTo(cardX + cardWidth, lineY)
      ctx.stroke()
      ctx.setLineDash([])

      // VERSO / BACK
      ctx.save()
      drawRoundRect(cardX, backY, cardWidth, cardHeight, 32)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
      ctx.strokeStyle = '#E2E8F0'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.clip()

      ctx.fillStyle = '#0F172A'
      ctx.fillRect(cardX, backY, cardWidth, 100)

      if (logoImg.width) {
        ctx.drawImage(logoImg, cardX + 40, backY + 125, 50, 50)
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = '#0F172A'
      ctx.font = 'bold 24px sans-serif'
      ctx.fillText(churchName, cardX + 110, backY + 150)
      ctx.fillStyle = '#64748B'
      ctx.font = '16px sans-serif'
      ctx.fillText('Carte de membre officielle', cardX + 110, backY + 175)

      const gridY = backY + 230
      ctx.font = 'bold 14px sans-serif'
      ctx.fillStyle = '#94A3B8'

      ctx.fillText('EMAIL', cardX + 40, gridY)
      ctx.fillText('TÉLÉPHONE', cardX + 460, gridY)
      ctx.fillText('DÉPARTEMENT', cardX + 40, gridY + 60)
      ctx.fillText('URGENCE', cardX + 460, gridY + 60)

      ctx.font = 'bold 18px sans-serif'
      ctx.fillStyle = '#1E293B'
      ctx.fillText(selectedMember.email || '—', cardX + 40, gridY + 25)
      ctx.fillText(selectedMember.phone || '—', cardX + 460, gridY + 25)
      ctx.fillText(selectedMember.department || '—', cardX + 40, gridY + 85)
      const emergency = [selectedMember.emergencyContactName, selectedMember.emergencyContactPhone].filter(Boolean).join(' ') || '—'
      ctx.fillText(emergency, cardX + 460, gridY + 85)

      const footerY = backY + 460
      if (cardData.qrCode) {
        const qrImg = await loadImage(cardData.qrCode)
        if (qrImg.width) {
          ctx.drawImage(qrImg, cardX + 40, footerY, 110, 110)
        }
      }

      ctx.textAlign = 'left'
      ctx.fillStyle = '#64748B'
      ctx.font = 'bold 18px monospace'
      ctx.fillText(formatCardNumber(cardData.cardNumber), cardX + 170, footerY + 50)
      ctx.font = '16px sans-serif'
      ctx.fillText(new Date(cardData.createdAt).toLocaleDateString('fr-FR'), cardX + 170, footerY + 80)

      ctx.textAlign = 'right'
      ctx.font = 'italic 16px sans-serif'
      ctx.fillStyle = '#94A3B8'
      ctx.fillText('Created by Henock Aduma', cardX + cardWidth - 40, footerY + 80)
      ctx.restore()

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Erreur de génération d'image")
          return
        }
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'carte_recto_verso.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setTimeout(() => URL.revokeObjectURL(url), 5000)
        toast.success('Image recto/verso téléchargée !')
      }, 'image/png', 1.0)
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors du téléchargement')
    }
  }

  function handleFlip() {
    setIsFlipping(true)
    setIsFlipped(!isFlipped)
    setTimeout(() => setIsFlipping(false), 700)
  }

  function formatCardNumber(num: string): string {
    const parts = num.split('-')
    if (parts.length >= 3) {
      return `MC-${parts[1]}${parts[2]}`
    }
    return num
  }

  const [activeTab, setActiveTab] = useState<'generate' | 'list'>('generate')
  const purchaseTotal = purchaseQuantity * 10

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cartes de Membre</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Générez des cartes de membre pour votre église.
          </p>
        </div>
        {/* Credit badge */}
        {!creditLoading && credit && (
          <Card className="sm:w-auto">
            <CardContent className="px-4 py-2 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">
                  {credit.remaining} carte{credit.remaining !== 1 ? 's' : ''} restante{credit.remaining !== 1 ? 's' : ''}
                </span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setPurchaseOpen(true)}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Acheter
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pending Orders Banner */}
      {pendingOrders.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Paiement{pendingOrders.length > 1 ? 's' : ''} en cours
                </p>
                {pendingOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 mt-2 py-2 border-t border-amber-200/50 dark:border-amber-800/50">
                    <div className="min-w-0">
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {order.quantity} carte{order.quantity !== 1 ? 's' : ''} — {formatUsd(order.totalPriceUsd)}
                      </p>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                        Créée le {new Date(order.createdAt).toLocaleDateString('fr-FR')} à {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-amber-700 dark:text-amber-300 hover:text-red-600 dark:hover:text-red-400 shrink-0"
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancellingId === order.id}
                    >
                      {cancellingId === order.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Annuler
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-2">
                  Complétez le paiement ou annulez pour libérer la commande.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : credit && credit.remaining <= 0 ? (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  Acheter des cartes
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Générer la carte
                </>
              )}
            </Button>
            {cardData && (
              <Button
                variant="default"
                className="w-full gap-2 h-10"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Télécharger la carte (Image PNG)
              </Button>
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
                          <div
                            className="absolute inset-0 opacity-[0.04]"
                            style={{
                              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.5) 8px, rgba(255,255,255,0.5) 9px)`,
                            }}
                          />
                          <div className="absolute inset-0 overflow-hidden">
                            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/5" />
                            <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/5" />
                            <div className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full bg-white/[0.03]" />
                          </div>
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
                          <div className="relative z-10 flex flex-col items-center gap-2">
                            <img src={auth.churchLogo || '/logo-mychurch.png'} alt="Church Logo" className="w-10 h-10 object-contain drop-shadow" />
                            <span className="text-xs font-bold tracking-[0.3em] uppercase text-white/90">{churchName}</span>
                          </div>
                          <div className="relative z-10 flex flex-col items-center gap-2.5">
                            <div className="h-20 w-20 rounded-full border-[3px] border-white/30 overflow-hidden shadow-lg">
                              {selectedMember.photo ? (
                                <img src={selectedMember.photo} alt={memberName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-white/15 flex items-center justify-center text-2xl font-bold text-white/80">
                                  {selectedMember.firstName[0]}{selectedMember.lastName[0]}
                                </div>
                              )}
                            </div>
                            <p className="text-xl font-bold tracking-wide text-center leading-tight">{memberName}</p>
                            <p className="text-xs font-mono tracking-[0.2em] text-white/60 uppercase">{formatCardNumber(cardData.cardNumber)}</p>
                          </div>
                          <div className="relative z-10 text-center">
                            <p className="text-[10px] font-bold tracking-[0.35em] text-white/40 uppercase">Member Card</p>
                          </div>
                        </div>
                      </div>

                      {/* BACK of card */}
                      <div
                        className="w-full aspect-[1.586/1] rounded-2xl overflow-hidden absolute inset-0"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        <div className="relative h-full bg-white flex flex-col justify-between p-6">
                          <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(0,0,0,0.8) 12px, rgba(0,0,0,0.8) 13px)` }} />
                          <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900" />
                          <div className="mt-16 flex items-center gap-3">
                            <img src={auth.churchLogo || '/logo-mychurch.png'} alt="Church Logo" className="h-10 w-10 object-contain rounded shadow-sm" />
                            <div>
                              <p className="text-sm font-bold text-gray-900 tracking-wide">{churchName}</p>
                              <p className="text-xs text-gray-500">Kinshasa, RDC</p>
                            </div>
                          </div>
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
                                  {[selectedMember.emergencyContactName, selectedMember.emergencyContactPhone].filter(Boolean).join(' · ') || '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-end justify-between mt-auto pt-3">
                            <div className="flex items-center gap-3">
                              <div className="h-14 w-14 rounded-lg border-2 border-gray-200 bg-gray-50 flex items-center justify-center">
                                {cardData.qrCode ? (
                                  <img src={cardData.qrCode} alt="QR Code" className="h-full w-full object-contain rounded-lg" />
                                ) : (
                                  <QrCode className="h-7 w-7 text-gray-300" />
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] font-mono text-gray-400 tracking-wider">{formatCardNumber(cardData.cardNumber)}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(cardData.createdAt).toLocaleDateString('fr-FR')}</p>
                              </div>
                            </div>
                            <p className="text-[9px] text-gray-300 italic text-right leading-tight max-w-[120px]">Created by Henock Aduma</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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

          {/* Guide */}
          <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Download className="h-4 w-4" />
                Comment utiliser la carte téléchargée
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p className="leading-relaxed">
                Après avoir cliqué sur <strong>Télécharger la carte</strong>, vous obtenez un fichier
                image <strong>carte_recto_verso.png</strong> haute définition (1000px) avec le Recto
                en haut et le Verso en bas.
              </p>
              <ol className="list-decimal list-inside space-y-1.5 font-medium text-foreground">
                <li>Ouvrez le fichier <strong>carte_recto_verso.png</strong> sur votre appareil.</li>
                <li>Imprimez-le via votre imprimante — cochez <strong>&laquo;&nbsp;Graphiques d&apos;arrière-plan&nbsp;&raquo;</strong> pour conserver les couleurs.</li>
                <li>Découpez le Recto (partie haute) et le Verso (partie basse) puis assemblez-les.</li>
                <li>Pour une carte plastifiée, plastifiez les deux faces assemblées.</li>
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

      {/* ─── Purchase Dialog ─── */}
      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Acheter des cartes de membre
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current credit info */}
            {credit && credit.totalPurchased > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span>
                  Solde actuel : <strong>{credit.remaining}</strong> carte{credit.remaining !== 1 ? 's' : ''} restante{credit.remaining !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Quantity selector */}
            <div className="space-y-2">
              <Label>Nombre de cartes</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                  disabled={purchaseQuantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={purchaseQuantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v >= 1 && v <= 999) setPurchaseQuantity(v)
                  }}
                  className="text-center text-lg font-bold h-12"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => setPurchaseQuantity(Math.min(999, purchaseQuantity + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Price summary */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                <span>{purchaseQuantity} carte{purchaseQuantity !== 1 ? 's' : ''} × {formatUsd(10)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-bold text-primary">{formatUsd(purchaseTotal)}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Paiement sécurisé via GeniusPay (Wave, Orange Money, MTN, Moov, Visa/Mastercard)
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handlePurchaseCards}
              disabled={purchasing || purchaseQuantity < 1}
              className="gap-2"
            >
              {purchasing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Payer {formatUsd(purchaseTotal)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
