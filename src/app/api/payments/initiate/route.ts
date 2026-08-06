import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createPayment, usdToXof } from '@/lib/geniuspay'
import { z } from 'zod'
import { NextRequest } from 'next/server'

const PRICING = { memberCard: 10, memberCardXOF: 6000, monthly: 50, annual: 100 }

const initiatePaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  paymentType: z.enum(['subscription', 'member_card']),
  memberId: z.string().optional(),
  plan: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
    const payload = await verifyAccessToken(token)
    if (!payload) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = initiatePaymentSchema.parse(body)

    // Get church info to check currency
    const church = await db.church.findUnique({
      where: { id: payload.churchId },
      select: { currency: true },
    })

    const targetCurrency = data.currency || church?.currency || 'USD'

    // Determine amount and currency based on targetCurrency
    let finalAmount: number
    let finalCurrency: string

    if (targetCurrency === 'USD') {
      finalCurrency = 'USD'
      if (data.paymentType === 'subscription') {
        finalAmount = data.plan === 'annual' ? PRICING.annual : PRICING.monthly
      } else {
        finalAmount = PRICING.memberCard
      }
    } else if (targetCurrency === 'CDF') {
      finalCurrency = 'CDF'
      const usdAmount = data.paymentType === 'subscription'
        ? (data.plan === 'annual' ? PRICING.annual : PRICING.monthly)
        : PRICING.memberCard
      // Approximate Congolese Franc rate: 1 USD = 2800 CDF
      finalAmount = Math.round(usdAmount * 2800)
    } else {
      // Default to XOF
      finalCurrency = 'XOF'
      if (data.paymentType === 'subscription') {
        const usdAmount = data.plan === 'annual' ? PRICING.annual : PRICING.monthly
        finalAmount = usdToXof(usdAmount)
      } else {
        finalAmount = PRICING.memberCardXOF
      }
    }

    // Get user info for customer details
    const user = await db.user.findFirst({
      where: { id: payload.userId },
      select: { firstName: true, lastName: true, email: true },
    })

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const metadata: Record<string, string | number> = {
      churchId: payload.churchId,
      userId: payload.userId,
      paymentType: data.paymentType,
    }
    if (data.memberId) metadata.memberId = data.memberId
    if (data.plan) metadata.plan = data.plan

    // Create payment via GeniusPay (no payment_method = checkout URL)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
    const paymentResponse = await createPayment({
      amount: finalAmount,
      currency: finalCurrency,
      description: data.description,
      customer: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      callback_url: `${baseUrl}/api/payments/webhook`,
      metadata,
    })

    if (!paymentResponse.success || !paymentResponse.data) {
      return Response.json(
        { error: paymentResponse.error?.message || 'Failed to create payment' },
        { status: 400 }
      )
    }

    const paymentData = paymentResponse.data
    const paymentUrl = paymentData.checkout_url || paymentData.payment_url || ''
    const reference = paymentData.reference

    // Save payment reference to the appropriate record
    if (data.paymentType === 'subscription' && data.plan) {
      // Deactivate old active subscriptions and create a pending one
      await db.subscription.updateMany({
        where: {
          churchId: payload.churchId,
          status: 'active',
        },
        data: { status: 'expired' },
      })

      const startDate = new Date()
      const endDate = new Date()
      if (data.plan === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1)
      } else {
        endDate.setMonth(endDate.getMonth() + 1)
      }

      await db.subscription.create({
        data: {
          churchId: payload.churchId,
          plan: data.plan,
          status: 'active',
          startDate,
          endDate,
          amount: finalAmount,
          currency: finalCurrency,
          paymentRef: reference,
          paymentStatus: 'pending',
          autoRenew: true,
        },
      })
    } else if (data.paymentType === 'member_card' && data.memberId) {
      await db.memberCard.updateMany({
        where: {
          memberId: data.memberId,
          churchId: payload.churchId,
        },
        data: { paymentRef: reference },
      })
    }

    return Response.json({
      paymentUrl,
      reference,
      amount: finalAmount,
      currency: finalCurrency,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Payment initiate error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}