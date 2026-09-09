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

      // Idempotency: check if already processed
      const existingOrder = await db.cardOrder.findUnique({
        where: { geniusReference: reference },
        select: { status: true },
      })
      const alreadyCompleted = existingOrder?.status === 'completed'

      // Update subscription payment status (idempotent)
      await db.subscription.updateMany({
        where: { paymentRef: reference, paymentStatus: { not: 'completed' } },
        data: { paymentStatus: 'completed', status: 'active' },
      })

      // Update member card payment status (idempotent)
      await db.memberCard.updateMany({
        where: { paymentRef: reference, isPaid: false },
        data: { isPaid: true },
      })

      // Handle CardOrder + CardCredit (bundle flow) — only if not already completed
      const fullOrder = existingOrder && !alreadyCompleted
        ? await db.cardOrder.findUnique({ where: { geniusReference: reference } })
        : null
      if (fullOrder) {
        await db.$transaction([
          db.cardOrder.update({
            where: { id: fullOrder.id },
            data: { status: 'completed', completedAt: new Date() },
          }),
          db.cardCredit.upsert({
            where: { userId: fullOrder.userId },
            create: {
              userId: fullOrder.userId,
              totalPurchased: fullOrder.quantity,
              totalGenerated: 0,
            },
            update: {
              totalPurchased: { increment: fullOrder.quantity },
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
