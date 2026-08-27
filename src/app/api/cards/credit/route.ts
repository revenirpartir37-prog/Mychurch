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

// GET: Return remaining card credit for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const credit = await db.cardCredit.findUnique({
      where: { userId: auth.userId },
    })

    const totalPurchased = credit?.totalPurchased ?? 0
    const totalGenerated = credit?.totalGenerated ?? 0
    const remaining = totalPurchased - totalGenerated

    return Response.json({
      remaining: Math.max(0, remaining),
      totalPurchased,
      totalGenerated,
    })
  } catch (error) {
    console.error('Card credit GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
