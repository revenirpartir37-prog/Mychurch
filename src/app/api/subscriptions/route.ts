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

    const subscription = await db.subscription.findFirst({
      where: { churchId: auth.churchId },
      orderBy: { createdAt: 'desc' },
    })

    // Vérification de paiement en attente
    if (verifyParam === 'true' && subscription?.paymentStatus === 'pending' && subscription.paymentRef) {
      try {
        const paymentResponse = await getPayment(subscription.paymentRef)
        if (paymentResponse.success && paymentResponse.data?.status === 'completed') {
          const updated = await db.subscription.update({
            where: { id: subscription.id },
            data: { paymentStatus: 'completed', status: 'active' },
          })
          return Response.json({
            subscription: updated,
            paymentVerified: true,
            isBranch,
            isHeadquarters,
            isExpired: false,
            canAccess: true,
            churchName: church.name,
            parentName: church.parent?.name,
          })
        }
      } catch {
        // En cas d'erreur de vérification, continuer
      }
    }

    const now = new Date()
    let isExpired = false
    let canAccess = true

    if (!subscription) {
      // Nouvelle église sans abonnement enregistré
      isExpired = true
      canAccess = isHeadquarters // L'église mère bénéficie de l'avantage de base, l'extension est bloquée
    } else {
      const isPast = new Date(subscription.endDate) < now
      const isNotActive = subscription.status !== 'active' || subscription.paymentStatus !== 'completed'
      isExpired = isPast || isNotActive

      if (isBranch) {
        // Église affiliée expirée = accès strictement restreint et interdit
        canAccess = !isExpired
      } else {
        // Église mère expirée = accès local conservé (avantage), mais alertée
        canAccess = true
      }
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
    console.error('Subscriptions GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create subscription with GeniusPay payment
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createSubscriptionSchema.parse(body)

    // Si targetChurchId est spécifié, vérifier que l'utilisateur est soit l'admin de cette église,
    // soit l'admin du Siège parent
    let targetChurchId = auth.churchId
    if (data.targetChurchId && data.targetChurchId !== auth.churchId) {
      const targetChurch = await db.church.findUnique({
        where: { id: data.targetChurchId },
      })
      if (!targetChurch) {
        return Response.json({ error: 'Église cible introuvable' }, { status: 404 })
      }
      if (targetChurch.parentId !== auth.churchId) {
        return Response.json({ error: 'Seule l’église mère peut régler pour cette extension' }, { status: 403 })
      }
      targetChurchId = data.targetChurchId
    }

    const user = await db.user.findFirst({
      where: { id: auth.userId },
      select: { firstName: true, lastName: true, email: true },
    })
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const targetChurch = await db.church.findUnique({
      where: { id: targetChurchId },
    })
    if (!targetChurch) {
      return Response.json({ error: 'Target church not found' }, { status: 404 })
    }

    const usdAmount = PLAN_PRICES[data.plan]
    if (!usdAmount) {
      return Response.json({ error: 'Plan invalide' }, { status: 400 })
    }

    const paymentAmount = usdToXof(usdAmount)
    const paymentCurrency = 'XOF'

    // Désactiver les anciens abonnements
    await db.subscription.updateMany({
      where: {
        churchId: targetChurchId,
        status: 'active',
      },
      data: { status: 'expired' },
    })

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
      description: `MYCHURCH abonnement ${data.plan} - ${targetChurch.name}`,
      customer: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      success_url: `${origin}/?view=dashboard&payment=success`,
      error_url: `${origin}/?view=dashboard&payment=error`,
      callback_url: `${origin}/api/payments/webhook`,
      metadata: {
        churchId: targetChurchId,
        userId: auth.userId,
        paymentType: 'subscription',
        plan: data.plan,
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