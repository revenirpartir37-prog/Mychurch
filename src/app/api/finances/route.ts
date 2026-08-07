import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

const createTransactionSchema = z.object({
  type: z.enum(['revenue', 'expense'], { message: 'Type must be revenue or expense' }),
  category: z.string().min(1, 'Category is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  location: z.string().default('cash'),
  description: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  recordedByName: z.string().optional().nullable(),
  beneficiary: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  signatureData: z.string().optional().nullable(),
})

const updateTransactionSchema = z.object({
  type: z.enum(['revenue', 'expense']).optional(),
  category: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  memberId: z.string().nullable().optional(),
  recordedByName: z.string().optional().nullable(),
  beneficiary: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  signatureData: z.string().optional().nullable(),
})

// GET: List transactions with filters and totals
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth || !auth.churchId || !auth.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const category = searchParams.get('category') || ''
    const currency = searchParams.get('currency') || ''
    const location = searchParams.get('location') || ''
    const memberId = searchParams.get('memberId') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { churchId: auth.churchId }

    if (type) where.type = type
    if (category) where.category = category
    if (currency) where.currency = currency
    if (location) where.location = location
    if (memberId) where.memberId = memberId

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) dateFilter.lte = new Date(endDate)
      where.date = dateFilter
    }

    const [transactions, total, totalsResult] = await Promise.all([
      db.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { member: { select: { id: true, firstName: true, lastName: true } } },
      }),
      db.transaction.count({ where }),
      // Get aggregated totals for revenue and expense
      db.transaction.groupBy({
        by: ['type'],
        where: {
          churchId: auth.churchId,
          ...(startDate || endDate
            ? {
                date: {
                  ...(startDate ? { gte: new Date(startDate) } : {}),
                  ...(endDate ? { lte: new Date(endDate) } : {}),
                },
              }
            : {}),
        },
        _sum: { amount: true },
      }),
    ])

    // Compute totals
    let totalRevenue = 0
    let totalExpense = 0
    for (const r of totalsResult) {
      if (r.type === 'revenue') totalRevenue = r._sum.amount || 0
      if (r.type === 'expense') totalExpense = r._sum.amount || 0
    }
    const balance = totalRevenue - totalExpense

    return Response.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      totals: {
        revenue: totalRevenue,
        expense: totalExpense,
        balance,
      },
    })
  } catch (error) {
    console.error('Finances GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create transaction
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth || !auth.churchId || !auth.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createTransactionSchema.parse(body)

    const transaction = await db.transaction.create({
      data: {
        churchId: auth.churchId,
        type: data.type,
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        location: data.location,
        description: data.description || null,
        date: data.date ? new Date(data.date) : new Date(),
        memberId: data.memberId || null,
        recordedByName: data.recordedByName || null,
        beneficiary: data.beneficiary || null,
        referenceNumber: data.referenceNumber || null,
        signatureData: data.signatureData || null,
        createdBy: auth.userId,
      },
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
    })

    // Log audit
    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'create_transaction',
      details: `Transaction ${data.type} créée: ${data.category} - ${data.amount} ${data.currency}`,
    })

    return Response.json({ transaction }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Finances POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Update transaction
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth || !auth.churchId || !auth.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return Response.json({ error: 'Transaction ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const data = updateTransactionSchema.parse(body)

    // Verify transaction belongs to this church
    const existing = await db.transaction.findFirst({
      where: { id, churchId: auth.churchId },
    })
    if (!existing) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.type !== undefined) updateData.type = data.type
    if (data.category !== undefined) updateData.category = data.category
    if (data.amount !== undefined) updateData.amount = data.amount
    if (data.currency !== undefined) updateData.currency = data.currency
    if (data.location !== undefined) updateData.location = data.location
    if (data.description !== undefined) updateData.description = data.description
    if (data.date !== undefined) updateData.date = data.date ? new Date(data.date) : null
    if (data.memberId !== undefined) updateData.memberId = data.memberId
    if (data.recordedByName !== undefined) updateData.recordedByName = data.recordedByName
    if (data.beneficiary !== undefined) updateData.beneficiary = data.beneficiary
    if (data.referenceNumber !== undefined) updateData.referenceNumber = data.referenceNumber
    if (data.signatureData !== undefined) updateData.signatureData = data.signatureData

    const transaction = await db.transaction.update({
      where: { id },
      data: updateData,
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
    })

    // Log audit
    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'update_transaction',
      details: `Transaction modifiée (ID: ${id})`,
    })

    return Response.json({ transaction })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Finances PUT error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Delete transaction (admin or treasurer only)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (auth.role !== 'admin' && auth.role !== 'treasurer') {
      return Response.json({ error: 'Only admins or treasurers can delete transactions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return Response.json({ error: 'Transaction ID is required' }, { status: 400 })
    }

    // Verify transaction belongs to this church
    const existing = await db.transaction.findFirst({
      where: { id, churchId: auth.churchId },
    })
    if (!existing) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 })
    }

    await db.transaction.delete({ where: { id } })

    // Log audit
    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'delete_transaction',
      details: `Transaction supprimée (ID: ${id})`,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Finances DELETE error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}