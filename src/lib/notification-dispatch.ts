import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { sendPushNotification } from '@/lib/onesignal'

type NotificationType = 'info' | 'success' | 'warning' | 'error'

interface BaseNotificationPayload {
  churchId: string
  title: string
  message: string
  type?: NotificationType
  push?: boolean
}

interface NotifyUserPayload extends BaseNotificationPayload {
  userId: string
}

interface NotifyUsersPayload extends BaseNotificationPayload {
  userIds: string[]
}

interface NotifyChurchUsersPayload extends BaseNotificationPayload {
  excludeUserIds?: string[]
  roles?: string[]
}

interface DispatchRemindersPayload {
  churchId: string
  eventIds?: string[]
  windowMinutesStart?: number
  windowMinutesEnd?: number
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

function formatEventDate(date: Date): string {
  return date.toLocaleString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function notifyUser({
  churchId,
  userId,
  title,
  message,
  type = 'info',
  push = true,
}: NotifyUserPayload) {
  const notification = await db.notification.create({
    data: { churchId, userId, title, message, type },
  })

  if (push) {
    const result = await sendPushNotification({
      title,
      message,
      userIds: [userId],
    })
    if (!result.ok) {
      console.warn(JSON.stringify({ scope: 'notification-dispatch', msg: 'PUSH_FAILED_NOTIFY_USER', reason: result.reason, userId, title }))
    }
  }

  return notification
}

export async function notifyUsers({
  churchId,
  userIds,
  title,
  message,
  type = 'info',
  push = true,
}: NotifyUsersPayload): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueUserIds.length === 0) return

  await db.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      churchId,
      userId,
      title,
      message,
      type,
    })),
  })

  if (!push) return
  const result = await sendPushNotification({
    title,
    message,
    userIds: uniqueUserIds,
  })
  if (!result.ok) {
    console.warn(JSON.stringify({ scope: 'notification-dispatch', msg: 'PUSH_FAILED_NOTIFY_USERS', reason: result.reason, count: uniqueUserIds.length }))
  }
}

export async function notifyChurchUsers({
  churchId,
  title,
  message,
  type = 'info',
  push = true,
  excludeUserIds = [],
  roles,
}: NotifyChurchUsersPayload): Promise<void> {
  const users = await db.user.findMany({
    where: {
      churchId,
      isActive: true,
      ...(excludeUserIds.length > 0 ? { id: { notIn: excludeUserIds } } : {}),
      ...(roles && roles.length > 0 ? { role: { in: roles } } : {}),
    },
    select: { id: true },
  })

  await notifyUsers({
    churchId,
    userIds: users.map((user) => user.id),
    title,
    message,
    type,
    push,
  })
}

export async function dispatchEventRemindersForChurch({
  churchId,
  eventIds,
  windowMinutesStart = 0,
  windowMinutesEnd = 24 * 60,
}: DispatchRemindersPayload): Promise<number> {
  const now = new Date()
  const windowStart = new Date(now.getTime() + windowMinutesStart * 60_000)
  const windowEnd = new Date(now.getTime() + windowMinutesEnd * 60_000)

  const events = await db.event.findMany({
    where: {
      churchId,
      startDate: { gte: windowStart, lte: windowEnd },
      ...(eventIds && eventIds.length > 0 ? { id: { in: eventIds } } : {}),
    },
    select: { id: true, title: true, startDate: true, location: true },
  })

  if (events.length === 0) return 0

  const users = await db.user.findMany({
    where: { churchId, isActive: true },
    select: { id: true },
  })
  if (users.length === 0) return 0

  // Batch par event: 1 findMany dedupe + 1 createMany + 1 push vs N×(create+notifyUser)
  let createdReminders = 0
  for (const event of events) {
    const dedupeKeys = users.map((u) => `event-reminder:${event.id}:${u.id}:${event.startDate.toISOString()}`)
    const existing = await db.churchSetting.findMany({
      where: { churchId, key: { in: dedupeKeys } },
      select: { key: true },
    })
    const existingSet = new Set(existing.map((e) => e.key))
    const toCreateKeys: string[] = []
    const toNotifyUserIds: string[] = []
    for (let i = 0; i < users.length; i++) {
      if (!existingSet.has(dedupeKeys[i])) {
        toCreateKeys.push(dedupeKeys[i])
        toNotifyUserIds.push(users[i].id)
      }
    }
    if (toCreateKeys.length === 0) continue
    // Crée les clés dedupe en batch (skipDuplicates évite race)
    try {
      await db.churchSetting.createMany({
        data: toCreateKeys.map((k) => ({ churchId, key: k, value: now.toISOString() })),
        skipDuplicates: true,
      })
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error
    }
    // Re-vérifie ce qui a vraiment été inséré (skipDuplicates)
    const createdKeys = await db.churchSetting.findMany({
      where: { churchId, key: { in: toCreateKeys } },
      select: { key: true },
    })
    if (createdKeys.length === 0) continue
    const createdSet = new Set(createdKeys.map((c) => c.key))
    const finalUserIds = toNotifyUserIds.filter((_, idx) => createdSet.has(toCreateKeys[idx]))
    if (finalUserIds.length === 0) continue
    const title = 'Rappel d’événement'
    const message = `${event.title} commence le ${formatEventDate(event.startDate)}${event.location ? ` à ${event.location}` : ''}.`
    await notifyUsers({ churchId, userIds: finalUserIds, title, message, type: 'info', push: true })
    createdReminders += finalUserIds.length
  }

  return createdReminders
}
