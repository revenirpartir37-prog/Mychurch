import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyUsers } from '@/lib/notification-dispatch'
import { z } from 'zod'
import { NextRequest } from 'next/server'

const bulkMessageSchema = z.object({
  recipientMemberIds: z
    .array(z.string().min(1))
    .min(1, 'Au moins un destinataire est requis'),
  subject: z.string().min(1, 'Le sujet est obligatoire'),
  content: z
    .string()
    .min(10, 'Le message doit contenir au moins 10 caractères')
    .max(2000, 'Le message ne peut pas dépasser 2000 caractères'),
})

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

// POST: Send bulk message to multiple members
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const data = bulkMessageSchema.parse(body)

    // Find members matching the requested IDs
    const members = await db.member.findMany({
      where: {
        id: { in: data.recipientMemberIds },
        churchId: auth.churchId,
        status: 'active',
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    if (members.length === 0) {
      return Response.json(
        { error: 'Aucun membre valide trouvé' },
        { status: 400 },
      )
    }

    // Find users whose email matches a selected member's email
    const memberEmails = members.map((m) => m.email).filter(Boolean) as string[]
    const users = memberEmails.length > 0
      ? await db.user.findMany({
          where: {
            email: { in: memberEmails },
            churchId: auth.churchId,
            isActive: true,
          },
          select: { id: true, email: true },
        })
      : []

    // Create individual messages for matched users
    const messages = users.length > 0
      ? await Promise.all(
          users.map((user) =>
            db.message.create({
              data: {
                churchId: auth.churchId,
                senderId: auth.userId,
                receiverId: user.id,
                subject: data.subject,
                content: data.content,
                isRead: false,
              },
            })
          )
        )
      : []

    const userEmails = new Set(users.map((u) => u.email))
    const deliveredToMemberIds = members
      .filter((m) => m.email && userEmails.has(m.email))
      .map((m) => m.id)

    // Create a sent copy for the sender
    const sentCopy = await db.message.create({
      data: {
        churchId: auth.churchId,
        senderId: auth.userId,
        receiverId: auth.userId,
        subject: `[Envoyé à ${messages.length} personne(s)] ${data.subject}`,
        content: data.content,
        isRead: true,
      },
    })

    const notFoundCount = data.recipientMemberIds.filter(
      (id) => !deliveredToMemberIds.includes(id),
    ).length

    if (users.length > 0) {
      const preview = data.content.length > 120 ? `${data.content.slice(0, 120)}...` : data.content
      await notifyUsers({
        churchId: auth.churchId,
        userIds: users.map((user) => user.id),
        title: `Nouveau message: ${data.subject}`,
        message: preview,
        type: 'info',
        push: true,
      })
    }

    return Response.json({
      sent: messages.length,
      failed: notFoundCount,
      message: sentCopy,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Validation échouée', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Bulk messages POST error:', error)
    return Response.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 },
    )
  }
}