import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { dispatchEventRemindersForChurch } from '@/lib/notification-dispatch'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.NOTIFICATIONS_CRON_SECRET
    const providedSecret = request.headers.get('x-notifications-secret')

    if (cronSecret && providedSecret === cronSecret) {
      const churches = await db.church.findMany({ select: { id: true } })
      let remindersCount = 0
      for (const church of churches) {
        remindersCount += await dispatchEventRemindersForChurch({ churchId: church.id })
      }

      return Response.json({
        success: true,
        scope: 'all-churches',
        remindersCount,
      })
    }

    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const remindersCount = await dispatchEventRemindersForChurch({
      churchId: auth.churchId,
    })

    return Response.json({
      success: true,
      scope: 'single-church',
      remindersCount,
    })
  } catch (error) {
    console.error('Notifications reminders POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
