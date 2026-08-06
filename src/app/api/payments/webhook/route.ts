import { NextRequest } from 'next/server'
import { verifyWebhookSignature } from '@/lib/geniuspay'
import { db } from '@/lib/db'

const WEBHOOK_SECRET = process.env.GENIUSPAY_WEBHOOK_SECRET || process.env.GENIUSPAY_API_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-signature') || ''
    const timestamp = request.headers.get('x-timestamp') || ''
    const rawBody = await request.text()

    if (!verifyWebhookSignature(rawBody, signature, timestamp, WEBHOOK_SECRET)) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const { event, data } = body

    if (event === 'payment.completed' && data?.reference) {
      const reference = data.reference

      // Update subscription payment status
      await db.subscription.updateMany({
        where: { paymentRef: reference },
        data: { paymentStatus: 'completed', status: 'active' },
      })

      // Update member card payment status
      await db.memberCard.updateMany({
        where: { paymentRef: reference },
        data: { isPaid: true },
      })
    } else if (event === 'payment.failed' && data?.reference) {
      const reference = data.reference

      await db.subscription.updateMany({
        where: { paymentRef: reference },
        data: { paymentStatus: 'failed' },
      })
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
