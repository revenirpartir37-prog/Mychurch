import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { normalizeCurrencyCode, SUPPORTED_CURRENCIES } from '@/lib/currency'
import { notifyChurchUsers, notifyUser } from '@/lib/notification-dispatch'
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

// GET: List transactions with filters and multi-currency balances
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth || !auth.churchId || !auth.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const category = searchParams.get('category') || ''
    const currency = normalizeCurrencyCode(searchParams.get('currency') || '')
    const location = searchParams.get('location') || ''
    const memberId = searchParams.get('memberId') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { churchId: auth.churchId }

    if (type) where.type = type
    if (category) where.category = category
    if (currency) {
      if (currency === 'CDF') {
        where.currency = { in: ['CDF', 'FC', 'cdf', 'fc'] }
      } else {
        where.currency = currency
      }
    }
    if (location) where.location = location
    if (memberId) where.memberId = memberId

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) dateFilter.lte = new Date(endDate)
      where.date = dateFilter
    }

    // Fetch church for base initial capital & currency
    const church = await db.church.findUnique({
      where: { id: auth.churchId },
      select: { currency: true, initialCapital: true },
    })

    const baseCurrency = normalizeCurrencyCode(church?.currency)
    const baseInitialCapital = church?.initialCapital || 0

    const [transactions, total, multiCurrencyTotals, totalCount] = await Promise.all([
      db.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { member: { select: { id: true, firstName: true, lastName: true } } },
      }),
      db.transaction.count({ where }),
      db.transaction.groupBy({
        by: ['currency', 'type'],
        where: { churchId: auth.churchId },
        _sum: { amount: true },
      }),
      db.transaction.count({ where: { churchId: auth.churchId } }),
    ])

    // Build multi-currency balances structure (ISO codes)
    const currencies = {
      USD: { initialCapital: baseCurrency === 'USD' ? baseInitialCapital : 0, revenue: 0, expense: 0, balance: 0 },
      EUR: { initialCapital: baseCurrency === 'EUR' ? baseInitialCapital : 0, revenue: 0, expense: 0, balance: 0 },
      CDF: { initialCapital: baseCurrency === 'CDF' ? baseInitialCapital : 0, revenue: 0, expense: 0, balance: 0 },
    }

    for (const item of multiCurrencyTotals) {
      const curr = normalizeCurrencyCode(item.currency) as 'USD' | 'EUR' | 'CDF'
      if (currencies[curr]) {
        if (item.type === 'revenue') currencies[curr].revenue += item._sum.amount || 0
        if (item.type === 'expense') currencies[curr].expense += item._sum.amount || 0
      }
    }

    for (const curr of SUPPORTED_CURRENCIES) {
      currencies[curr].balance = currencies[curr].initialCapital + currencies[curr].revenue - currencies[curr].expense
    }

    // Next reference number formatted as 6 digits, e.g., 000001
    const nextRefNumber = String(totalCount + 1).padStart(6, '0')
    const nextRefNumberFormatted = `REF-${nextRefNumber}`

    const targetCurrency = (currency && currencies[currency as keyof typeof currencies]) ? currency : baseCurrency

    return Response.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      currencies,
      churchCurrency: baseCurrency,
      nextReferenceNumber: nextRefNumber,
      nextReferenceNumberFormatted: nextRefNumberFormatted,
      totals: {
        revenue: currencies[targetCurrency as keyof typeof currencies]?.revenue || 0,
        expense: currencies[targetCurrency as keyof typeof currencies]?.expense || 0,
        balance: currencies[targetCurrency as keyof typeof currencies]?.balance || 0,
      },
    })
  } catch (error) {
    console.error('Finances GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create transaction with currency balance check & 6-digit reference validation
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth || !auth.churchId || !auth.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createTransactionSchema.parse(body)
    const targetCurrency = normalizeCurrencyCode(data.currency)

    // 1. Fetch current balance for the selected currency
    const church = await db.church.findUnique({
      where: { id: auth.churchId },
      select: { currency: true, initialCapital: true },
    })

    const baseCurrency = normalizeCurrencyCode(church?.currency)
    const initialCapital = baseCurrency === targetCurrency ? (church?.initialCapital || 0) : 0

    const currencyTotals = await db.transaction.groupBy({
      by: ['type'],
      where: {
        churchId: auth.churchId,
        currency: targetCurrency === 'CDF' ? { in: ['CDF', 'FC', 'cdf', 'fc'] } : targetCurrency,
      },
      _sum: { amount: true },
    })

    let currentRevenue = 0
    let currentExpense = 0
    for (const item of currencyTotals) {
      if (item.type === 'revenue') currentRevenue = item._sum.amount || 0
      if (item.type === 'expense') currentExpense = item._sum.amount || 0
    }

    const availableBalance = initialCapital + currentRevenue - currentExpense

    // If expense, check that cash balance is sufficient
    if (data.type === 'expense' && data.amount > availableBalance) {
      return Response.json(
        {
          error: `Solde de caisse insuffisant en ${targetCurrency}. Solde disponible: ${availableBalance.toLocaleString()} ${targetCurrency}, montant requis: ${data.amount.toLocaleString()} ${targetCurrency}.`,
        },
        { status: 400 }
      )
    }

    // 2. Validate & format 6-digit reference number (e.g. 000001 or REF-000001)
    const totalCount = await db.transaction.count({ where: { churchId: auth.churchId } })
    const autoRefNumber = String(totalCount + 1).padStart(6, '0')
    let refNum = data.referenceNumber?.trim()

    if (!refNum || refNum === '' || refNum === '000000' || refNum.startsWith('AUTO') || refNum === `REF-${autoRefNumber}` || refNum === autoRefNumber) {
      refNum = `REF-${autoRefNumber}`
    } else {
      // Validate custom entered reference: must exist in church transactions or match 6-digit pattern
      const cleanRef = refNum.replace(/^REF-/, '')
      const existingRef = await db.transaction.findFirst({
        where: { churchId: auth.churchId, OR: [{ referenceNumber: refNum }, { referenceNumber: `REF-${cleanRef}` }, { referenceNumber: cleanRef }] },
      })
      if (!existingRef && !/^\d{6}$/.test(cleanRef)) {
        return Response.json(
          { error: 'Numéro de référence invalide. Doit être au format 6 chiffres (ex: 000001) ou correspondre à une transaction existante.' },
          { status: 400 }
        )
      }
      refNum = refNum.startsWith('REF-') ? refNum : `REF-${cleanRef.padStart(6, '0')}`
    }

    const transaction = await db.transaction.create({
      data: {
        churchId: auth.churchId,
        type: data.type,
        category: data.category,
        amount: data.amount,
        currency: targetCurrency,
        location: data.location,
        description: data.description || null,
        date: data.date ? new Date(data.date) : new Date(),
        memberId: data.memberId || null,
        recordedByName: data.recordedByName || null,
        beneficiary: data.beneficiary || null,
        referenceNumber: refNum,
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
      details: `Transaction ${data.type} créée: ${data.category} - ${data.amount} ${targetCurrency} (Réf: ${refNum})`,
    })

    await notifyChurchUsers({
      churchId: auth.churchId,
      roles: ['admin', 'treasurer'],
      title: data.type === 'revenue' ? 'Nouvelle entrée financière' : 'Nouvelle dépense',
      message: `${data.category}: ${data.amount} ${targetCurrency} (Réf ${refNum}).`,
      type: data.type === 'revenue' ? 'success' : 'warning',
      push: true,
    })
    await notifyUser({
      churchId: auth.churchId,
      userId: auth.userId,
      title: 'Transaction enregistrée',
      message: `La transaction ${data.category} (${data.amount} ${targetCurrency}) a été enregistrée.`,
      type: 'success',
      push: false,
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
    if (data.currency !== undefined) updateData.currency = normalizeCurrencyCode(data.currency)
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

    await notifyChurchUsers({
      churchId: auth.churchId,
      roles: ['admin', 'treasurer'],
      title: 'Transaction mise à jour',
      message: `La transaction ${transaction.referenceNumber || id} a été modifiée.`,
      type: 'warning',
      push: true,
    })
    await notifyUser({
      churchId: auth.churchId,
      userId: auth.userId,
      title: 'Modification enregistrée',
      message: `La transaction ${transaction.referenceNumber || id} a été mise à jour.`,
      type: 'success',
      push: false,
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

    await notifyChurchUsers({
      churchId: auth.churchId,
      roles: ['admin', 'treasurer'],
      title: 'Transaction supprimée',
      message: `Une transaction (${existing.referenceNumber || id}) a été supprimée.`,
      type: 'error',
      push: true,
    })
    await notifyUser({
      churchId: auth.churchId,
      userId: auth.userId,
      title: 'Suppression effectuée',
      message: `La transaction ${existing.referenceNumber || id} a été supprimée.`,
      type: 'success',
      push: false,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Finances DELETE error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}