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

const attendanceRecordSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  eventId: z.string().optional().nullable(),
  status: z.enum(['present', 'absent', 'late']).default('present'),
  date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

const bulkAttendanceSchema = z.array(attendanceRecordSchema).min(1, 'At least one record is required')

// GET: List attendance records with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId') || ''
    const memberId = searchParams.get('memberId') || ''
    const date = searchParams.get('date') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = { churchId: auth.churchId }

    if (eventId) where.eventId = eventId
    if (memberId) where.memberId = memberId
    if (status) where.status = status
    if (date) {
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(23, 59, 59, 999)
      where.date = { gte: dayStart, lte: dayEnd }
    }

    const [records, total] = await Promise.all([
      db.attendance.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          member: { select: { id: true, firstName: true, lastName: true, photo: true } },
          event: { select: { id: true, title: true, type: true } },
        },
      }),
      db.attendance.count({ where }),
    ])

    // Get summary counts
    const summary = await db.attendance.groupBy({
      by: ['status'],
      where: {
        churchId: auth.churchId,
        ...(date
          ? {
              date: {
                gte: new Date(date + 'T00:00:00'),
                lte: new Date(date + 'T23:59:59'),
              },
            }
          : {}),
        ...(eventId ? { eventId } : {}),
      },
      _count: { status: true },
    })

    const summaryMap: Record<string, number> = {}
    for (const s of summary) {
      summaryMap[s.status] = s._count.status
    }

    return Response.json({
      records,
      summary: {
        present: summaryMap['present'] || 0,
        absent: summaryMap['absent'] || 0,
        late: summaryMap['late'] || 0,
        total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Attendance GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Bulk create/update attendance records
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = bulkAttendanceSchema.parse(body)

    const results: any[] = []

    for (const record of data) {
      // Verify member belongs to this church
      const member = await db.member.findFirst({
        where: { id: record.memberId, churchId: auth.churchId },
      })
      if (!member) continue

      // If eventId provided, verify it belongs to this church
      if (record.eventId) {
        const event = await db.event.findFirst({
          where: { id: record.eventId, churchId: auth.churchId },
        })
        if (!event) continue
      }

      // Upsert: find existing record for this member+event+date combination
      const existing = await db.attendance.findFirst({
        where: {
          churchId: auth.churchId,
          memberId: record.memberId,
          eventId: record.eventId || null,
          date: record.date ? new Date(record.date) : new Date(),
        },
      })

      if (existing) {
        // Update existing
        const updated = await db.attendance.update({
          where: { id: existing.id },
          data: {
            status: record.status,
            notes: record.notes || null,
          },
          include: {
            member: { select: { id: true, firstName: true, lastName: true } },
            event: { select: { id: true, title: true } },
          },
        })
        results.push(updated)
      } else {
        // Create new
        const created = await db.attendance.create({
          data: {
            churchId: auth.churchId,
            memberId: record.memberId,
            eventId: record.eventId || null,
            status: record.status,
            date: record.date ? new Date(record.date) : new Date(),
            notes: record.notes || null,
          },
          include: {
            member: { select: { id: true, firstName: true, lastName: true } },
            event: { select: { id: true, title: true } },
          },
        })
        results.push(created)
      }
    }

    return Response.json({ records: results, count: results.length }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Attendance POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}