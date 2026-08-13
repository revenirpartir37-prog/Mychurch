import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyUser } from '@/lib/notification-dispatch'
import { z } from 'zod'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

const createNotificationSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
})

const markReadSchema = z.object({
  ids: z.array(z.string()).min(1, 'At least one ID is required'),
})

// GET: List notifications for current user + unreadCount
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const isReadFilter = searchParams.get('isRead')

    const where: Record<string, unknown> = {
      churchId: auth.churchId,
      userId: auth.userId,
    }

    if (unreadOnly) {
      where.isRead = false
    }

    if (isReadFilter !== null && isReadFilter !== undefined && isReadFilter !== '') {
      where.isRead = isReadFilter === 'true'
    }

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: {
          churchId: auth.churchId,
          userId: auth.userId,
          isRead: false,
        },
      }),
    ])

    return Response.json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create notification
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createNotificationSchema.parse(body)

    // Verify target user is in the same church
    const targetUser = await db.user.findFirst({
      where: { id: data.userId, churchId: auth.churchId },
    })
    if (!targetUser) {
      return Response.json({ error: 'Target user not found' }, { status: 404 })
    }

    const notification = await notifyUser({
      churchId: auth.churchId,
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
    })

    return Response.json({ notification }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Notifications POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = markReadSchema.parse(body)

    // Only update notifications belonging to this user and church
    const result = await db.notification.updateMany({
      where: {
        id: { in: data.ids },
        churchId: auth.churchId,
        userId: auth.userId,
      },
      data: { isRead: true },
    })

    return Response.json({ updated: result.count })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Notifications PUT error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Delete notification
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return Response.json({ error: 'Notification ID is required' }, { status: 400 })
    }

    // Verify notification belongs to this user and church
    const existing = await db.notification.findFirst({
      where: { id, churchId: auth.churchId, userId: auth.userId },
    })
    if (!existing) {
      return Response.json({ error: 'Notification not found' }, { status: 404 })
    }

    await db.notification.delete({ where: { id } })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Notifications DELETE error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}