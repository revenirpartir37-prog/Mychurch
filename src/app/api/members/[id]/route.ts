import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  return await verifyAccessToken(token)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get member with churchId check
    const member = await db.member.findFirst({
      where: { id, churchId: auth.churchId },
    })

    if (!member) {
      return Response.json({ error: 'Membre non trouvé' }, { status: 404 })
    }

    // Calculate date 90 days ago
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    // Fetch attendance records (last 90 days) with event title
    const attendanceRecords = await db.attendance.findMany({
      where: {
        memberId: id,
        churchId: auth.churchId,
        date: { gte: ninetyDaysAgo },
      },
      include: {
        event: {
          select: { title: true },
        },
      },
      orderBy: { date: 'desc' },
    })

    // Fetch transactions linked to this member
    const transactions = await db.transaction.findMany({
      where: {
        memberId: id,
        churchId: auth.churchId,
      },
      orderBy: { date: 'desc' },
    })

    // Calculate attendance stats
    const totalEvents = attendanceRecords.length
    const presentCount = attendanceRecords.filter((a) => a.status === 'present').length
    const lateCount = attendanceRecords.filter((a) => a.status === 'late').length
    const absentCount = attendanceRecords.filter((a) => a.status === 'absent').length
    const attendedCount = presentCount + lateCount
    const attendanceRate = totalEvents > 0 ? Math.round((attendedCount / totalEvents) * 100) : 0

    // Calculate financial stats
    const totalContributions = transactions.reduce((sum, t) => sum + t.amount, 0)
    const contributionCount = transactions.length
    const averageContribution = contributionCount > 0 ? totalContributions / contributionCount : 0

    return Response.json({
      member,
      attendance: {
        records: attendanceRecords,
        stats: {
          totalEvents,
          presentCount,
          lateCount,
          absentCount,
          attendedCount,
          attendanceRate,
        },
      },
      transactions: {
        records: transactions,
        stats: {
          totalAmount: totalContributions,
          count: contributionCount,
          averageAmount: averageContribution,
        },
      },
    })
  } catch (error) {
    console.error('Member detail GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}