import { NextRequest } from 'next/server'
import { verifyWebhookSignature } from '@/lib/geniuspay'
import { db } from '@/lib/db'

const WEBHOOK_SECRET = process.env.GENIUSPAY_WEBHOOK_SECRET || process.env.GENIUSPAY_API_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-webhook-signature') || request.headers.get('x-signature') || ''
    const timestamp = request.headers.get('x-webhook-timestamp') || request.headers.get('x-timestamp') || ''
    const rawBody = await request.text()

    if (!verifyWebhookSignature(rawBody, signature, timestamp, WEBHOOK_SECRET)) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const event = request.headers.get('x-webhook-event') || body.event
    const data = body.data

    if (event === 'payment.completed' && data?.reference) {
      const reference = data.reference

      // Update subscription payment status
      await db.subscription.updateMany({
        where: { paymentRef: reference },
        data: { paymentStatus: 'completed', status: 'active' },
      })

      // Update member card payment status (legacy single-card flow)
      await db.memberCard.updateMany({
        where: { paymentRef: reference },
        data: { isPaid: true },
      })

      // Handle CardOrder + CardCredit (bundle flow)
      const order = await db.cardOrder.findUnique({
        where: { geniusReference: reference },
      })

      if (order && order.status !== 'completed') {
        await db.$transaction([
          db.cardOrder.update({
            where: { id: order.id },
            data: { status: 'completed', completedAt: new Date() },
          }),
          db.cardCredit.upsert({
            where: { userId: order.userId },
            create: {
              userId: order.userId,
              totalPurchased: order.quantity,
              totalGenerated: 0,
            },
            update: {
              totalPurchased: { increment: order.quantity },
            },
          }),
        ])
      }
    } else if (event === 'payment.failed' && data?.reference) {
      const reference = data.reference

      await db.subscription.updateMany({
        where: { paymentRef: reference },
        data: { paymentStatus: 'failed' },
      })

      await db.cardOrder.updateMany({
        where: { geniusReference: reference },
        data: { status: 'failed' },
      })
    } else if (event === 'payment.expired' && data?.reference) {
      await db.cardOrder.updateMany({
        where: { geniusReference: data.reference },
        data: { status: 'expired' },
      })
    } else if (event === 'payment.cancelled' && data?.reference) {
      await db.cardOrder.updateMany({
        where: { geniusReference: data.reference },
        data: { status: 'cancelled' },
      })
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
