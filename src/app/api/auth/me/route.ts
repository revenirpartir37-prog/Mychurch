import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyAccessToken(token)
    if (!payload) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const user = await db.user.findFirst({
      where: { id: payload.userId, churchId: payload.churchId },
      select: {
        id: true,
        churchId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        verified: true,
        firebaseUid: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const church = await db.church.findUnique({
      where: { id: payload.churchId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        logo: true,
        address: true,
        city: true,
        province: true,
        country: true,
        currency: true,
        initialCapital: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!church) {
      return Response.json({ error: 'Church not found' }, { status: 404 })
    }

    return Response.json({ user, church })
  } catch (error) {
    console.error('Auth me error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}