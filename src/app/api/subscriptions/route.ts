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

const PLAN_PRICES: Record<string, number> = {
  monthly: 50,
  annual: 100,
}

const createSubscriptionSchema = z.object({
  plan: z.enum(['monthly', 'annual'], { message: 'Plan must be monthly or annual' }),
  paymentMethod: z.enum(['airtel_money', 'mtn_money', 'orange_money', 'card', 'wave']).optional(),
})

// GET: Get current church subscription (supports ?verify=true to check pending payment)
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const verifyParam = searchParams.get('verify')

    const subscription = await db.subscription.findFirst({
      where: { churchId: auth.churchId },
      orderBy: { createdAt: 'desc' },
    })

    if (!subscription) {
      return Response.json({ error: 'No subscription found' }, { status: 404 })
    }

    // If verify=true and payment is pending, check payment status
    if (verifyParam === 'true' && subscription.paymentStatus === 'pending' && subscription.paymentRef) {
      try {
        const paymentResponse = await getPayment(subscription.paymentRef)
        if (paymentResponse.success && paymentResponse.data?.status === 'completed') {
          const updated = await db.subscription.update({
            where: { id: subscription.id },
            data: { paymentStatus: 'completed' },
          })
          return Response.json({ subscription: updated, paymentVerified: true })
        }
      } catch {
        // Payment check failed, return current subscription status
      }
    }

    return Response.json({ subscription })
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

    // Get user info for customer details
    const user = await db.user.findFirst({
      where: { id: auth.userId },
      select: { firstName: true, lastName: true, email: true },
    })
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Get church info for currency
    const church = await db.church.findUnique({
      where: { id: auth.churchId },
    })
    if (!church) {
      return Response.json({ error: 'Church not found' }, { status: 404 })
    }

    const usdAmount = PLAN_PRICES[data.plan]

    // GeniusPay only supports XOF
    const paymentAmount = usdToXof(usdAmount)
    const paymentCurrency = 'XOF'

    // Deactivate old active subscriptions
    await db.subscription.updateMany({
      where: {
        churchId: auth.churchId,
        status: 'active',
      },
      data: { status: 'expired' },
    })

    // Calculate dates
    const startDate = new Date()
    const endDate = new Date()
    if (data.plan === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1)
    } else {
      endDate.setMonth(endDate.getMonth() + 1)
    }

    // Create payment via GeniusPay (no payment_method = checkout URL where user picks method)
    const paymentParams: any = {
      amount: paymentAmount,
      currency: paymentCurrency,
      description: `MYCHURCH ${data.plan} subscription - ${church.name}`,
      customer: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      metadata: {
        churchId: auth.churchId,
        userId: auth.userId,
        paymentType: 'subscription',
        plan: data.plan,
      },
    }

    // Map payment method to GeniusPay gateway/provider
    if (data.paymentMethod) {
      if (data.paymentMethod === 'card') {
        paymentParams.gateway = 'paystack'
        paymentParams.payment_method = 'card'
      } else {
        // Mobile money: use pawapay gateway
        paymentParams.gateway = 'pawapay'
        paymentParams.payment_method = 'pawapay'
        paymentParams.mmo_provider = data.paymentMethod
      }
    }

    const paymentResponse = await createPayment(paymentParams)

    if (!paymentResponse.success || !paymentResponse.data) {
      return Response.json(
        { error: paymentResponse.error?.message || 'Failed to create payment' },
        { status: 400 }
      )
    }

    const paymentData = paymentResponse.data
    const paymentUrl = paymentData.checkout_url || paymentData.payment_url || ''
    const reference = paymentData.reference

    // Create subscription with pending payment status
    const subscription = await db.subscription.create({
      data: {
        churchId: auth.churchId,
        plan: data.plan,
        status: 'active',
        startDate,
        endDate,
        amount: usdAmount,
        currency: 'USD',
        paymentRef: reference,
        paymentStatus: 'pending',
        autoRenew: true,
      },
    })

    return Response.json({
      subscription,
      paymentUrl,
      reference,
      amount: paymentAmount,
      currency: paymentCurrency,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Subscriptions POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}