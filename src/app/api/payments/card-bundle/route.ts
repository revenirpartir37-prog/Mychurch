import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createPayment } from '@/lib/geniuspay'
import { z } from 'zod'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

const bundleSchema = z.object({
  quantity: z.number().int().min(1, 'Quantité invalide'),
})

// POST: Initiate payment for a bundle of membership cards (quantity x $10 USD)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quantity } = bundleSchema.parse(body)

    const user = await db.user.findFirst({
      where: { id: auth.userId },
      select: { firstName: true, lastName: true, email: true },
    })
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const unitPrice = 10
    const total = quantity * unitPrice

    const order = await db.cardOrder.create({
      data: {
        userId: auth.userId,
        quantity,
        unitPriceUsd: unitPrice,
        totalPriceUsd: total,
      },
    })

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''

    const paymentResponse = await createPayment({
      amount: total,
      currency: 'USD',
      description: `Achat de ${quantity} cartes de membre`,
      customer: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      success_url: `${origin}/?view=member-cards&payment=success&order=${order.id}`,
      error_url: `${origin}/?view=member-cards&payment=error&order=${order.id}`,
      callback_url: `${origin}/api/payments/webhook`,
      metadata: {
        order_id: order.id,
        user_id: auth.userId,
        quantity,
        type: 'card_bundle',
      },
    })

    if (!paymentResponse.success || !paymentResponse.data) {
      return Response.json(
        { error: paymentResponse.error?.message || 'Failed to create payment' },
        { status: 400 }
      )
    }

    const paymentData = paymentResponse.data
    const checkoutUrl = paymentData.checkout_url || paymentData.payment_url || ''

    await db.cardOrder.update({
      where: { id: order.id },
      data: { geniusReference: paymentData.reference },
    })

    return Response.json({ checkoutUrl, reference: paymentData.reference, orderId: order.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Card bundle payment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
