import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

// PUT: Mark all unread notifications as read for the current user
export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyAccessToken(token)
    if (!payload) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await db.notification.updateMany({
      where: {
        churchId: payload.churchId,
        userId: payload.userId,
        isRead: false,
      },
      data: { isRead: true },
    })

    return Response.json({ success: true, updatedCount: result.count })
  } catch (error) {
    console.error('Mark all read error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}