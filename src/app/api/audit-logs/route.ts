import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  return await verifyAccessToken(token)
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().optional(),
})

// GET: List paginated audit logs for the church
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.safeParse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      action: searchParams.get('action') || undefined,
    })

    if (!query.success) {
      return Response.json({ error: 'Validation failed', details: query.error.issues }, { status: 400 })
    }

    const { page, limit, action } = query.data

    const where: Record<string, unknown> = { churchId: auth.churchId }
    if (action) where.action = action

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
      }),
      db.auditLog.count({ where }),
    ])

    return Response.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Audit logs GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}