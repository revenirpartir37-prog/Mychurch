import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

// GET: List pending card orders for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pendingOrders = await db.cardOrder.findMany({
      where: {
        userId: auth.userId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json({ orders: pendingOrders })
  } catch (error) {
    console.error('Pending orders GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
