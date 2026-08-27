import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

const cancelSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
})

// POST: Cancel a pending card order
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId } = cancelSchema.parse(body)

    const order = await db.cardOrder.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return Response.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    if (order.userId !== auth.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (order.status !== 'pending') {
      return Response.json(
        { error: 'Seules les commandes en attente peuvent être annulées' },
        { status: 400 }
      )
    }

    await db.cardOrder.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    })

    return Response.json({ ok: true, message: 'Commande annulée' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Cancel payment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
