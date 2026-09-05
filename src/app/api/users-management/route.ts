import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { notifyChurchUsers, notifyUser } from '@/lib/notification-dispatch'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  return verifyAccessToken(token)
}

const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'treasurer', 'secretary', 'reader']),
  phone: z.string().optional().nullable(),
  function: z.string().optional().nullable(),
})

const updateUserSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'treasurer', 'secretary', 'reader']).optional(),
  phone: z.string().optional().nullable(),
  function: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth || !auth.churchId || !auth.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Number(searchParams.get('limit') || 20))
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || undefined

    const where: Record<string, unknown> = { churchId: auth.churchId }
    if (role) where.role = role
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          phone: true,
          function: true,
          isActive: true,
          verified: true,
          lastLogin: true,
          createdAt: true,
        },
      }),
      db.user.count({ where }),
    ])

    return Response.json({
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    console.error('Users-management GET:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth || !auth.churchId || !auth.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

    const body = await req.json()
    const data = createUserSchema.parse(body)

    // Check email uniqueness within the church
    const existing = await db.user.findFirst({
      where: { churchId: auth.churchId, email: data.email },
    })
    if (existing) {
      return Response.json({ error: 'Un utilisateur avec cet email existe déjà' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    // Create user in Supabase Auth if possible
    let firebaseUid: string | null = null
    try {
      const { createSupabaseUser } = await import('@/lib/supabase')
      firebaseUid = await createSupabaseUser(data.email, data.password)
    } catch {
      // Non-blocking fallback
    }

    const user = await db.user.create({
      data: {
        churchId: auth.churchId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash,
        firebaseUid,
        role: data.role,
        phone: data.phone ?? null,
        function: data.function ?? null,
        isActive: true,
        verified: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        phone: true,
        function: true,
        isActive: true,
        createdAt: true,
      },
    })

    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'create_user',
      details: `${data.firstName} ${data.lastName} — ${data.email} — ${data.role}`,
    })

    notifyChurchUsers({
      churchId: auth.churchId,
      roles: ['admin'],
      title: 'Utilisateur créé',
      message: `${data.firstName} ${data.lastName} (${data.role}) a été ajouté.`,
      type: 'info',
      push: true,
    }).catch((err) => console.warn('[Users POST] notifyChurchUsers failed:', err))

    notifyUser({
      churchId: auth.churchId,
      userId: user.id,
      title: 'Compte activé',
      message: 'Votre compte MYCHURCH a été créé. Connectez-vous pour commencer.',
      type: 'success',
      push: true,
    }).catch((err) => console.warn('[Users POST] notifyUser failed:', err))

    return Response.json({ user }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Validation', details: e.issues }, { status: 400 })
    console.error('Users-management POST:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth || !auth.churchId || !auth.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

    const body = await req.json()
    const data = updateUserSchema.parse(body)

    const existing = await db.user.findFirst({
      where: { id: data.id, churchId: auth.churchId },
    })
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

    // Prevent deactivating yourself
    if (data.id === auth.userId && data.isActive === false) {
      return Response.json({ error: 'Vous ne pouvez pas vous désactiver vous-même' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.email !== undefined) updateData.email = data.email
    if (data.role !== undefined) updateData.role = data.role
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.function !== undefined) updateData.function = data.function
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12)
      try {
        const { updateSupabasePassword } = await import('@/lib/supabase')
        await updateSupabasePassword(existing.email, data.password)
      } catch {
        // Non-blocking
      }
    }

    const user = await db.user.update({
      where: { id: data.id },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        phone: true,
        function: true,
        isActive: true,
        createdAt: true,
      },
    })

    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'update_user',
      details: `ID: ${data.id}`,
    })

    notifyChurchUsers({
      churchId: auth.churchId,
      roles: ['admin'],
      title: 'Utilisateur mis à jour',
      message: `${user.firstName} ${user.lastName} a été modifié.`,
      type: 'warning',
      push: true,
    }).catch((err) => console.warn('[Users PATCH] notifyChurchUsers failed:', err))

    notifyUser({
      churchId: auth.churchId,
      userId: user.id,
      title: 'Profil mis à jour',
      message: 'Vos informations de compte ont été mises à jour.',
      type: 'info',
      push: true,
    }).catch((err) => console.warn('[Users PATCH] notifyUser failed:', err))

    return Response.json({ user })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Validation', details: e.issues }, { status: 400 })
    console.error('Users-management PATCH:', e)
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

    if (id === auth.userId) {
      return Response.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 })
    }

    const existing = await db.user.findFirst({ where: { id, churchId: auth.churchId } })
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

    // Soft delete — deactivate rather than delete to preserve audit trail
    await db.user.update({ where: { id }, data: { isActive: false } })

    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'delete_user',
      details: `${existing.firstName} ${existing.lastName} — ${existing.email}`,
    })

    notifyChurchUsers({
      churchId: auth.churchId,
      roles: ['admin'],
      title: 'Utilisateur désactivé',
      message: `${existing.firstName} ${existing.lastName} a été désactivé.`,
      type: 'error',
      push: true,
    }).catch((err) => console.warn('[Users DELETE] notifyChurchUsers failed:', err))

    notifyUser({
      churchId: auth.churchId,
      userId: existing.id,
      title: 'Compte désactivé',
      message: 'Votre accès à MYCHURCH a été désactivé par un administrateur.',
      type: 'error',
      push: true,
    }).catch((err) => console.warn('[Users DELETE] notifyUser failed:', err))

    return Response.json({ success: true })
  } catch (e) {
    console.error('Users-management DELETE:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
