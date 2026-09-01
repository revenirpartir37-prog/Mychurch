import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { notifyChurchUsers, notifyUser } from '@/lib/notification-dispatch'
import { z } from 'zod'
import { NextRequest } from 'next/server'

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Au moins un ID est requis'),
})

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

const createMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  type: z.enum(['member', 'personnel']).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  function: z.string().optional().nullable(),
  salary: z.number().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  joinDate: z.string().optional().nullable(),
})

const updateMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  type: z.enum(['member', 'personnel']).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  function: z.string().optional().nullable(),
  salary: z.number().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
})

// GET: List members with search, filters, pagination
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const department = searchParams.get('department') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const where: Record<string, unknown> = { churchId: auth.churchId }

    if (status) where.status = status
    if (department) where.department = department
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) dateFilter.lte = new Date(endDate)
      where.joinDate = dateFilter
    }

    const [members, total] = await Promise.all([
      db.member.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.member.count({ where }),
    ])

    return Response.json({
      members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Members GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create new member
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createMemberSchema.parse(body)

    const member = await db.member.create({
      data: {
        churchId: auth.churchId,
        firstName: data.firstName,
        lastName: data.lastName,
        type: data.type || 'member',
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        department: data.department || null,
        function: data.function || null,
        salary: data.salary ?? null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        photo: data.photo || null,
        joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
      },
    })

    // Log audit
    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'create_member',
      details: `Membre créé: ${data.firstName} ${data.lastName}`,
    })

    await notifyChurchUsers({
      churchId: auth.churchId,
      excludeUserIds: [auth.userId],
      title: 'Nouveau membre enregistré',
      message: `${data.firstName} ${data.lastName} a été ajouté.`,
      type: 'info',
      push: true,
    })
    await notifyUser({
      churchId: auth.churchId,
      userId: auth.userId,
      title: 'Membre créé',
      message: `${data.firstName} ${data.lastName} a été enregistré avec succès.`,
      type: 'success',
      push: false,
    })

    return Response.json({ member }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Members POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Update member
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return Response.json({ error: 'Member ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const data = updateMemberSchema.parse(body)

    // Verify member belongs to this church
    const existing = await db.member.findFirst({
      where: { id, churchId: auth.churchId },
    })
    if (!existing) {
      return Response.json({ error: 'Member not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.type !== undefined) updateData.type = data.type
    if (data.phone !== undefined) updateData.phone = data.phone || null
    if (data.email !== undefined) updateData.email = data.email || null
    if (data.address !== undefined) updateData.address = data.address || null
    if (data.department !== undefined) updateData.department = data.department || null
    if (data.function !== undefined) updateData.function = data.function || null
    if (data.salary !== undefined) updateData.salary = data.salary ?? null
    if (data.emergencyContactName !== undefined) updateData.emergencyContactName = data.emergencyContactName || null
    if (data.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = data.emergencyContactPhone || null
    if (data.photo !== undefined) updateData.photo = data.photo || null
    if (data.status !== undefined) updateData.status = data.status

    const member = await db.member.update({
      where: { id },
      data: updateData,
    })

    // Log audit
    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'update_member',
      details: `Membre modifié: ${existing.firstName} ${existing.lastName} (ID: ${id})`,
    })

    await notifyChurchUsers({
      churchId: auth.churchId,
      excludeUserIds: [auth.userId],
      title: 'Membre mis à jour',
      message: `${existing.firstName} ${existing.lastName} a été modifié.`,
      type: 'warning',
      push: true,
    })
    await notifyUser({
      churchId: auth.churchId,
      userId: auth.userId,
      title: 'Modification enregistrée',
      message: `Le profil de ${existing.firstName} ${existing.lastName} a été mis à jour.`,
      type: 'success',
      push: false,
    })

    return Response.json({ member })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Members PUT error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Soft delete (single via query param or bulk via JSON body)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''

    // Bulk delete via JSON body
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const data = bulkDeleteSchema.parse(body)

      const result = await db.member.updateMany({
        where: {
          id: { in: data.ids },
          churchId: auth.churchId,
        },
        data: { status: 'inactive' },
      })

      createAuditLog({
        churchId: auth.churchId,
        userId: auth.userId,
        action: 'bulk_delete_members',
        details: `Suppression en masse: ${result.count} membre(s) désactivé(s)`,
      })

      await notifyChurchUsers({
        churchId: auth.churchId,
        excludeUserIds: [auth.userId],
        title: 'Membres désactivés',
        message: `${result.count} membre(s) ont été désactivé(s).`,
        type: 'error',
        push: true,
      })
      await notifyUser({
        churchId: auth.churchId,
        userId: auth.userId,
        title: 'Suppression en masse effectuée',
        message: `${result.count} membre(s) ont été désactivé(s).`,
        type: 'success',
        push: false,
      })

      return Response.json({ deleted: result.count })
    }

    // Single delete via query param
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return Response.json({ error: 'Member ID is required' }, { status: 400 })
    }

    // Verify member belongs to this church
    const existing = await db.member.findFirst({
      where: { id, churchId: auth.churchId },
    })
    if (!existing) {
      return Response.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = await db.member.update({
      where: { id },
      data: { status: 'inactive' },
    })

    // Log audit
    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'delete_member',
      details: `Membre désactivé: ${existing.firstName} ${existing.lastName} (ID: ${id})`,
    })

    await notifyChurchUsers({
      churchId: auth.churchId,
      excludeUserIds: [auth.userId],
      title: 'Membre désactivé',
      message: `${existing.firstName} ${existing.lastName} a été désactivé.`,
      type: 'error',
      push: true,
    })
    await notifyUser({
      churchId: auth.churchId,
      userId: auth.userId,
      title: 'Suppression effectuée',
      message: `${existing.firstName} ${existing.lastName} a été désactivé.`,
      type: 'success',
      push: false,
    })

    return Response.json({ member })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Members DELETE error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}