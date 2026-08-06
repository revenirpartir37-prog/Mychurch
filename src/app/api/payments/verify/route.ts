import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { getPayment } from '@/lib/geniuspay'
import { z } from 'zod'
import { NextRequest } from 'next/server'

const verifyPaymentSchema = z.object({
  reference: z.string().min(1, 'Payment reference is required'),
  paymentType: z.enum(['subscription', 'member_card']),
})

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
    const payload = await verifyAccessToken(token)
    if (!payload) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = verifyPaymentSchema.parse(body)

    // Check payment status with GeniusPay
    const paymentResponse = await getPayment(data.reference)

    if (!paymentResponse.success || !paymentResponse.data) {
      return Response.json(
        { error: paymentResponse.error?.message || 'Failed to verify payment' },
        { status: 400 }
      )
    }

    const paymentData = paymentResponse.data
    const isCompleted = paymentData.status === 'completed'

    if (isCompleted) {
      if (data.paymentType === 'subscription') {
        // Update subscription status
        await db.subscription.updateMany({
          where: {
            churchId: payload.churchId,
            paymentRef: data.reference,
          },
          data: {
            paymentStatus: 'completed',
          },
        })

        // Create a transaction record
        await db.transaction.create({
          data: {
            churchId: payload.churchId,
            type: 'revenue',
            category: 'subscription_fee',
            amount: paymentData.amount,
            currency: paymentData.currency,
            location: 'bank',
            description: `Subscription payment - ${paymentData.reference}`,
            createdBy: payload.userId,
          },
        })
      } else if (data.paymentType === 'member_card') {
        // Update member card
        await db.memberCard.updateMany({
          where: {
            churchId: payload.churchId,
            paymentRef: data.reference,
          },
          data: {
            isPaid: true,
            paidAmount: paymentData.amount,
            paymentRef: data.reference,
          },
        })

        // Create a transaction record
        await db.transaction.create({
          data: {
            churchId: payload.churchId,
            type: 'revenue',
            category: 'card_fee',
            amount: paymentData.amount,
            currency: paymentData.currency,
            location: 'bank',
            description: `Member card payment - ${paymentData.reference}`,
            createdBy: payload.userId,
          },
        })
      }
    }

    return Response.json({
      status: paymentData.status,
      verified: isCompleted,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Payment verify error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}