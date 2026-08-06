import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { NextRequest } from 'next/server'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  return verifyAccessToken(token)
}

/** Returns the current month string (YYYY-MM) and year (YYYY) to block archiving the live period. */
function getCurrentPeriods() {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return { year, month }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || undefined
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Number(searchParams.get('limit') || 20))

    const where: Record<string, unknown> = { churchId: auth.churchId }
    if (type) where.type = type

    const [archives, total] = await Promise.all([
      db.archive.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.archive.count({ where }),
    ])

    return Response.json({
      archives,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    console.error('Archives GET:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

    const body = await req.json()
    const { type, period } = body

    if (!type || !period) {
      return Response.json({ error: 'type and period are required' }, { status: 400 })
    }

    // Block archiving the current live period
    const { year: currentYear, month: currentMonth } = getCurrentPeriods()
    if (type === 'annual' && period === currentYear) {
      return Response.json(
        { error: `Impossible d'archiver l'année en cours (${currentYear}). Attendez la fin de l'année.` },
        { status: 422 }
      )
    }
    if (type === 'monthly' && period === currentMonth) {
      return Response.json(
        { error: `Impossible d'archiver le mois en cours (${currentMonth}). Attendez la fin du mois.` },
        { status: 422 }
      )
    }

    // Collect data for the archive (filtered by period)
    let dateFilter: Record<string, Date> = {}
    if (type === 'monthly') {
      const [year, month] = period.split('-')
      const start = new Date(parseInt(year), parseInt(month) - 1, 1)
      const end = new Date(parseInt(year), parseInt(month), 1)
      dateFilter = { gte: start, lt: end }
    } else if (type === 'annual') {
      const start = new Date(parseInt(period), 0, 1)
      const end = new Date(parseInt(period) + 1, 0, 1)
      dateFilter = { gte: start, lt: end }
    }

    const [transactions, members, events, attendance] = await Promise.all([
      db.transaction.findMany({ where: { churchId: auth.churchId, date: dateFilter } }),
      db.member.findMany({ where: { churchId: auth.churchId, joinDate: dateFilter } }),
      db.event.findMany({ where: { churchId: auth.churchId, startDate: dateFilter } }),
      db.attendance.findMany({ where: { churchId: auth.churchId, date: dateFilter } }),
    ])

    const data = JSON.stringify({ transactions, members, events, attendance })
    const recordCount = transactions.length + members.length + events.length + attendance.length

    // Check if archive for this period already exists
    const existing = await db.archive.findFirst({
      where: { churchId: auth.churchId, type, period },
    })

    if (existing) {
      const updated = await db.archive.update({
        where: { id: existing.id },
        data: { data, size: Buffer.byteLength(data, 'utf8'), recordCount, userId: auth.userId },
      })
      createAuditLog({
        churchId: auth.churchId,
        userId: auth.userId,
        action: 'archive_updated',
        details: `Type: ${type}, Période: ${period}`,
      })
      return Response.json({ archive: updated })
    }

    const archive = await db.archive.create({
      data: {
        churchId: auth.churchId,
        type,
        period,
        data,
        size: Buffer.byteLength(data, 'utf8'),
        recordCount,
        userId: auth.userId,
      },
    })

    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'archive_created',
      details: `Type: ${type}, Période: ${period}, Records: ${recordCount}`,
    })

    return Response.json({ archive }, { status: 201 })
  } catch (e) {
    console.error('Archives POST:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  // Restore an archive: re-imports transactions and events back to live DB
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'id requis' }, { status: 400 })

    const archive = await db.archive.findFirst({ where: { id, churchId: auth.churchId } })
    if (!archive) return Response.json({ error: 'Archive introuvable' }, { status: 404 })
    if (!archive.data) return Response.json({ error: 'Archive vide' }, { status: 422 })

    let parsed: {
      transactions?: Record<string, unknown>[]
      members?: Record<string, unknown>[]
      events?: Record<string, unknown>[]
      attendance?: Record<string, unknown>[]
    }
    try {
      parsed = JSON.parse(archive.data)
    } catch {
      return Response.json({ error: "Données d'archive corrompues" }, { status: 422 })
    }

    let restoredCount = 0

    // Restore transactions (skip duplicates by id)
    if (Array.isArray(parsed.transactions)) {
      for (const tx of parsed.transactions) {
        const exists = await db.transaction.findUnique({ where: { id: tx.id as string } }).catch(() => null)
        if (!exists) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await db.transaction.create({ data: { ...(tx as any), churchId: auth.churchId } })
            restoredCount++
          } catch { /* skip constraint violations */ }
        }
      }
    }

    // Restore events (skip duplicates)
    if (Array.isArray(parsed.events)) {
      for (const ev of parsed.events) {
        const exists = await db.event.findUnique({ where: { id: ev.id as string } }).catch(() => null)
        if (!exists) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await db.event.create({ data: { ...(ev as any), churchId: auth.churchId } })
            restoredCount++
          } catch { /* skip */ }
        }
      }
    }

    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'archive_restored',
      details: `Archive ID: ${id}, Période: ${archive.period}, Enregistrements restaurés: ${restoredCount}`,
    })

    return Response.json({ success: true, restoredCount, period: archive.period })
  } catch (e) {
    console.error('Archives PATCH (restore):', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'id requis' }, { status: 400 })

    const existing = await db.archive.findFirst({ where: { id, churchId: auth.churchId } })
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

    await db.archive.delete({ where: { id } })

    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'archive_deleted',
      details: `ID: ${id}`,
    })

    return Response.json({ success: true })
  } catch (e) {
    console.error('Archives DELETE:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
