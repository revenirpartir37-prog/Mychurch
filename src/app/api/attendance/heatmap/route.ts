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

const heatmapQuerySchema = z.object({
  weekOffset: z.coerce.number().int().default(0),
})

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
  // Get Monday of current week
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)

  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d)
  }
  return dates
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = heatmapQuerySchema.parse({
      weekOffset: searchParams.get('weekOffset') || '0',
    })

    const weekDates = getWeekDates(query.weekOffset)
    const dateStrings = weekDates.map(formatDateISO)

    const weekStart = weekDates[0]
    const weekEnd = weekDates[6]
    weekEnd.setHours(23, 59, 59, 999)

    // Fetch all attendance records for this church within the week
    const records = await db.attendance.findMany({
      where: {
        churchId: auth.churchId,
        date: { gte: weekStart, lte: weekEnd },
      },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    // Group by memberId
    const memberMap = new Map<string, {
      id: string
      firstName: string
      lastName: string
      days: Map<string, string>
    }>()

    for (const record of records) {
      if (!record.member) continue

      const dateStr = formatDateISO(new Date(record.date))
      let entry = memberMap.get(record.memberId)
      if (!entry) {
        entry = {
          id: record.member.id,
          firstName: record.member.firstName,
          lastName: record.member.lastName,
          days: new Map(),
        }
        memberMap.set(record.memberId, entry)
      }
      entry.days.set(dateStr, record.status)
    }

    // Only include members who have at least one attendance record in the week
    const members = Array.from(memberMap.values()).map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      days: dateStrings.map((date) => ({
        date,
        status: m.days.get(date) || null,
      })),
    }))

    return Response.json({ dates: dateStrings, members })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Attendance heatmap error:', error)
    return Response.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}