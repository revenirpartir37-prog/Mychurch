import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createPayment, getPayment, usdToXof } from '@/lib/geniuspay'
import { z } from 'zod'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

export const PLAN_PRICES: Record<string, number> = {
  monthly: 50,
  annual: 100,
  annual_branch: 30,
}

const createSubscriptionSchema = z.object({
  plan: z.enum(['monthly', 'annual', 'annual_branch'], { message: 'Plan invalide' }),
  targetChurchId: z.string().optional(),
  paymentMethod: z.enum(['airtel_money', 'mtn_money', 'orange_money', 'card', 'wave']).optional(),
})

// GET: Get current church subscription and access status
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const verifyParam = searchParams.get('verify')

    const church = await db.church.findUnique({
      where: { id: auth.churchId },
      include: {
        parent: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!church) {
      return Response.json({ error: 'Church not found' }, { status: 404 })
    }

    const isBranch = !!church.parentId
    const isHeadquarters = !isBranch

    // 1. Chercher prioritairement un abonnement actif (payant, à vie ou essai en cours)
    let subscription = await db.subscription.findFirst({
      where: {
        churchId: auth.churchId,
        status: 'active',
        paymentStatus: 'completed',
      },
      orderBy: { createdAt: 'desc' },
    })

    // 2. Si aucun actif, vérifier s'il y a un abonnement récent (en attente ou expiré)
    if (!subscription) {
      subscription = await db.subscription.findFirst({
        where: { churchId: auth.churchId },
        orderBy: { createdAt: 'desc' },
      })
    }

    // Vérification automatique de paiement en attente (auto-check sur GeniusPay)
    if (subscription?.paymentStatus === 'pending' && subscription.paymentRef) {
      try {
        const paymentResponse = await getPayment(subscription.paymentRef)
        if (paymentResponse.success && paymentResponse.data?.status === 'completed') {
          const updated = await db.subscription.update({
            where: { id: subscription.id },
            data: { paymentStatus: 'completed', status: 'active' },
          })
          subscription = updated
        }
      } catch {
        // En cas d'erreur de vérification, continuer
      }
    }

    const now = new Date()
    let isExpired = false
    let canAccess = true

    if (!subscription) {
      // Première visite sans abonnement : octroi automatique de 7 jours d'essai gratuit
      const trialEndDate = new Date()
      trialEndDate.setDate(trialEndDate.getDate() + 7)

      const trialSub = await db.subscription.create({
        data: {
          churchId: auth.churchId,
          plan: 'trial',
          status: 'active',
          startDate: new Date(),
          endDate: trialEndDate,
          amount: 0,
          currency: 'USD',
          paymentStatus: 'completed',
          paymentRef: `TRIAL-AUTO-${Date.now()}`,
        },
      })

      return Response.json({
        subscription: trialSub,
        isBranch,
        isHeadquarters,
        isExpired: false,
        canAccess: true,
        churchName: church.name,
        parentName: church.parent?.name,
      })
    }

    if (subscription.plan === 'lifetime') {
      isExpired = false
      canAccess = true
    } else if (subscription.status === 'active' && subscription.paymentStatus === 'completed') {
      const isPast = new Date(subscription.endDate) < now
      isExpired = isPast
      canAccess = !isExpired
    } else {
      isExpired = true
      canAccess = false
    }

    return Response.json({
      subscription,
      isBranch,
      isHeadquarters,
      isExpired,
      canAccess,
      churchName: church.name,
      parentName: church.parent?.name,
    })
  } catch (error) {
    console.error('Subscription GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create subscription with GeniusPay payment (en USD direct)
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
    const auth = await verifyAccessToken(token)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createSubscriptionSchema.parse(body)

    const user = await db.user.findFirst({
      where: { id: auth.userId },
      select: { firstName: true, lastName: true, email: true, role: true },
    })

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Déterminer l'église cible (soit l'église de l'admin, soit une église fille à renouveler)
    const targetChurchId = data.targetChurchId || auth.churchId

    const targetChurch = await db.church.findUnique({
      where: { id: targetChurchId },
      select: { id: true, name: true, parentId: true },
    })

    if (!targetChurch) {
      return Response.json({ error: 'Target church not found' }, { status: 404 })
    }

    const usdAmount = PLAN_PRICES[data.plan]
    if (!usdAmount) {
      return Response.json({ error: 'Plan invalide' }, { status: 400 })
    }

    // Facturation directe en USD
    const paymentAmount = usdAmount
    const paymentCurrency = 'USD'

    const startDate = new Date()
    const endDate = new Date()
    if (data.plan === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1)
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1)
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
    const paymentParams: any = {
      amount: paymentAmount,
      currency: paymentCurrency,
      description: `${paymentAmount}.00 $ USD - Abonnement ${data.plan === 'monthly' ? 'Mensuel' : 'Annuel'} MYCHURCH (${targetChurch.name})`,
      customer: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      success_url: `${origin}/?view=settings&tab=abonnement&payment=success`,
      error_url: `${origin}/?view=settings&tab=abonnement&payment=error`,
      callback_url: `${origin}/api/payments/webhook`,
      metadata: {
        churchId: targetChurchId,
        userId: auth.userId,
        paymentType: 'subscription',
        plan: data.plan,
        currency: 'USD',
        amount: paymentAmount,
      },
    }

    if (data.paymentMethod) {
      if (data.paymentMethod === 'card') {
        paymentParams.gateway = 'paystack'
        paymentParams.payment_method = 'card'
      } else {
        paymentParams.gateway = 'pawapay'
        paymentParams.payment_method = 'pawapay'
        paymentParams.mmo_provider = data.paymentMethod
      }
    }

    const paymentResponse = await createPayment(paymentParams)

    if (!paymentResponse.success || !paymentResponse.data) {
      console.error('GeniusPay subscription error:', paymentResponse.error)
      return Response.json(
        { error: paymentResponse.error?.message || 'Erreur lors de l’initialisation du paiement' },
        { status: 400 }
      )
    }

    const paymentData = paymentResponse.data
    const paymentUrl = paymentData.checkout_url || paymentData.payment_url || ''
    const reference = paymentData.reference

    const subscription = await db.subscription.create({
      data: {
        churchId: targetChurchId,
        plan: data.plan,
        status: 'pending',
        startDate,
        endDate,
        amount: usdAmount,
        currency: 'USD',
        paymentRef: reference,
        paymentStatus: 'pending',
      },
    })

    return Response.json({
      subscriptionId: subscription.id,
      paymentUrl,
      reference,
    })
  } catch (error) {
    console.error('Subscription POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}