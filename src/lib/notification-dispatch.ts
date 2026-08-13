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
}) {
  const notification = await db.notification.create({
    data: { churchId, userId, title, message, type },
  })

  if (push) {
    await sendPushNotification({
      title,
      message,
      userIds: [userId],
    })
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
  await sendPushNotification({
    title,
    message,
    userIds: uniqueUserIds,
  })
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

  let createdReminders = 0
  for (const event of events) {
    for (const user of users) {
      const dedupeKey = `event-reminder:${event.id}:${user.id}:${event.startDate.toISOString()}`
      try {
        await db.churchSetting.create({
          data: {
            churchId,
            key: dedupeKey,
            value: now.toISOString(),
          },
        })

        const title = 'Rappel d’événement'
        const message = `${event.title} commence le ${formatEventDate(event.startDate)}${event.location ? ` à ${event.location}` : ''}.`
        await notifyUser({
          churchId,
          userId: user.id,
          title,
          message,
          type: 'info',
          push: true,
        })
        createdReminders += 1
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error
        }
      }
    }
  }

  return createdReminders
}
