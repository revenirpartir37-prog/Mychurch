import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  return await verifyAccessToken(token)
}

const sendMessageSchema = z.object({
  receiverId: z.string().min(1, 'Receiver ID is required'),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Content is required'),
})

const updateMessageSchema = z.object({
  id: z.string().min(1, 'Message ID is required'),
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
})

// GET: List messages for current user
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder') || 'inbox'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { churchId: auth.churchId }

    if (folder === 'sent') {
      where.senderId = auth.userId
    } else if (folder === 'archived') {
      where.receiverId = auth.userId
      where.isArchived = true
    } else {
      // inbox
      where.receiverId = auth.userId
      where.isArchived = false
    }

    const [messages, total] = await Promise.all([
      db.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sender: { select: { id: true, firstName: true, lastName: true } },
          receiver: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      db.message.count({ where }),
    ])

    return Response.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Messages GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Send message
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = sendMessageSchema.parse(body)

    // Verify receiver exists in the same church
    const receiver = await db.user.findFirst({
      where: { id: data.receiverId, churchId: auth.churchId },
    })
    if (!receiver) {
      return Response.json({ error: 'Receiver not found' }, { status: 404 })
    }

    const message = await db.message.create({
      data: {
        churchId: auth.churchId,
        senderId: auth.userId,
        receiverId: data.receiverId,
        subject: data.subject,
        content: data.content,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
        receiver: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return Response.json({ message }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Messages POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Mark as read / archive
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = updateMessageSchema.parse(body)

    // Verify message belongs to this church and user is sender or receiver
    const existing = await db.message.findFirst({
      where: {
        id: data.id,
        churchId: auth.churchId,
        OR: [{ senderId: auth.userId }, { receiverId: auth.userId }],
      },
    })
    if (!existing) {
      return Response.json({ error: 'Message not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.isRead !== undefined) updateData.isRead = data.isRead
    if (data.isArchived !== undefined) updateData.isArchived = data.isArchived

    const message = await db.message.update({
      where: { id: data.id },
      data: updateData,
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
        receiver: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return Response.json({ message })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Messages PUT error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}