import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  type: z.enum(['culte', 'reunion', 'seminar', 'conference', 'formation'], {
    message: 'Invalid event type',
  }),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
})

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(['culte', 'reunion', 'seminar', 'conference', 'formation']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().optional().nullable(),
})

// GET: List events with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { churchId: auth.churchId }

    if (type) where.type = type

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) dateFilter.lte = new Date(endDate)
      where.startDate = dateFilter
    }

    const [events, total] = await Promise.all([
      db.event.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { attendance: true } },
        },
      }),
      db.event.count({ where }),
    ])

    return Response.json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Events GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create event
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createEventSchema.parse(body)

    const event = await db.event.create({
      data: {
        churchId: auth.churchId,
        title: data.title,
        description: data.description || null,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        location: data.location || null,
        createdBy: auth.userId,
      },
    })

    // Log audit
    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'create_event',
      details: `Événement créé: ${data.title} (${data.type})`,
    })

    return Response.json({ event }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Events POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Update event
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return Response.json({ error: 'Event ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const data = updateEventSchema.parse(body)

    const existing = await db.event.findFirst({
      where: { id, churchId: auth.churchId },
    })
    if (!existing) {
      return Response.json({ error: 'Event not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.type !== undefined) updateData.type = data.type
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate)
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null
    if (data.location !== undefined) updateData.location = data.location

    const event = await db.event.update({
      where: { id },
      data: updateData,
    })

    // Log audit
    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'update_event',
      details: `Événement modifié (ID: ${id})`,
    })

    return Response.json({ event })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Events PUT error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Delete event
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return Response.json({ error: 'Event ID is required' }, { status: 400 })
    }

    const existing = await db.event.findFirst({
      where: { id, churchId: auth.churchId },
    })
    if (!existing) {
      return Response.json({ error: 'Event not found' }, { status: 404 })
    }

    await db.event.delete({ where: { id } })

    // Log audit
    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'delete_event',
      details: `Événement supprimé (ID: ${id})`,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Events DELETE error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}