import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { normalizeCurrencyCode, SUPPORTED_CURRENCIES } from '@/lib/currency'
import { dispatchEventRemindersForChurch } from '@/lib/notification-dispatch'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

// GET: Charge TOUTES les données du dashboard en UNE seule requête
// (stats + transactions récentes + membres récents + audit + événements + dettes).
// Réduit drastiquement le nombre de cold starts / connexions DB à l'ouverture.
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, churchId } = auth

    // Reminders découplés du chemin critique — ne bloque pas la réponse dashboard
    void dispatchEventRemindersForChurch({ churchId }).catch((e) =>
      console.warn(JSON.stringify({ scope: 'dashboard:reminders', msg: 'FAILED', error: e instanceof Error ? e.message : String(e) }))
    )

    const startOfYear = new Date(new Date().getFullYear(), 0, 1)
    const results = await Promise.allSettled([
      db.member.count({ where: { churchId } }),
      db.event.count({ where: { churchId } }),
      db.attendance.count({ where: { churchId } }),
      db.church.findUnique({
        where: { id: churchId },
        select: { currency: true, initialCapital: true },
      }),
      db.transaction.findMany({
        where: { churchId },
        orderBy: { date: 'desc' },
        take: 5,
        include: { member: { select: { id: true, firstName: true, lastName: true } } },
      }),
      db.member.findMany({
        where: { churchId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.auditLog.findMany({
        where: { churchId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
      }),
      db.event.findMany({
        where: { churchId },
        orderBy: { startDate: 'asc' },
        take: 5,
        select: { id: true, title: true, type: true, startDate: true, location: true },
      }),
      role === 'admin'
        ? db.debt.findMany({
            where: { churchId, status: 'pending' },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : Promise.resolve(null),
      db.transaction.groupBy({
        by: ['type', 'currency'],
        where: { churchId, date: { gte: startOfYear } },
        _sum: { amount: true },
      }),
    ])

    const ok = <T>(r: PromiseSettledResult<T>) => r.status === 'fulfilled' ? r.value : null
    const memberCount = ok(results[0]) ?? 0
    const eventCount = ok(results[1]) ?? 0
    const attendanceCount = ok(results[2]) ?? 0
    const church = ok(results[3])
    const recentTransactions = ok(results[4]) ?? []
    const recentMembers = ok(results[5]) ?? []
    const auditLogs = ok(results[6]) ?? []
    const upcomingEvents = ok(results[7]) ?? []
    const pendingDebts = ok(results[8]) ?? null
    const totals = ok(results[9]) ?? []

    const baseCurrency = normalizeCurrencyCode(church?.currency)
    const baseInitialCapital = church?.initialCapital || 0

    const currencies: Record<string, { initialCapital: number; revenue: number; expense: number; balance: number }> = {
      USD: { initialCapital: baseCurrency === 'USD' ? baseInitialCapital : 0, revenue: 0, expense: 0, balance: 0 },
      EUR: { initialCapital: baseCurrency === 'EUR' ? baseInitialCapital : 0, revenue: 0, expense: 0, balance: 0 },
      CDF: { initialCapital: baseCurrency === 'CDF' ? baseInitialCapital : 0, revenue: 0, expense: 0, balance: 0 },
    }

    for (const item of totals) {
      const curr = normalizeCurrencyCode(item.currency) as 'USD' | 'EUR' | 'CDF'
      if (currencies[curr]) {
        if (item.type === 'revenue') currencies[curr].revenue += item._sum.amount || 0
        if (item.type === 'expense') currencies[curr].expense += item._sum.amount || 0
      }
    }

    for (const curr of SUPPORTED_CURRENCIES) {
      currencies[curr].balance = currencies[curr].initialCapital + currencies[curr].revenue - currencies[curr].expense
    }

    const now = new Date()
    const futureEvents = (upcomingEvents || []).filter((e) => new Date(e.startDate) > now)

    return Response.json({
      stats: {
        totalMembers: memberCount,
        monthlyRevenue: currencies[baseCurrency as keyof typeof currencies]?.revenue || 0,
        totalExpense: currencies[baseCurrency as keyof typeof currencies]?.expense || 0,
        upcomingEvents: futureEvents.length,
        monthlyAttendance: attendanceCount,
      },
      recentTransactions,
      recentMembers,
      auditLogs,
      upcomingEvents: futureEvents,
      pendingDebts,
    })
  } catch (error) {
    console.error('Dashboard GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}