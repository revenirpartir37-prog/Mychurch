import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { NextRequest } from 'next/server'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

const createSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['USD', 'FC', 'EUR']).default('USD'),
  creditor: z.string().min(1),
  description: z.string().optional().nullable(),
})

const approveSchema = z.object({
  debtId: z.string(),
  action: z.enum(['approved', 'rejected']),
  comment: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Number(searchParams.get('limit') || 20))
    const where: any = { churchId: auth.churchId }
    if (status) where.status = status
    const [debts, total, pendingCount] = await Promise.all([
      db.debt.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { payments: true } }),
      db.debt.count({ where }),
      db.debt.count({ where: { churchId: auth.churchId, status: 'pending' } }),
    ])
    return Response.json({ debts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, pendingCount })
  } catch (e) {
    console.error('Debts GET:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin' && auth.role !== 'treasurer') return Response.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const data = createSchema.parse(body)
    const thresholdKey = data.currency === 'USD' ? 'debt_threshold_usd' : 'debt_threshold_cdf'
    const setting = await db.churchSetting.findFirst({ where: { churchId: auth.churchId, key: thresholdKey } })
    const threshold = setting ? parseFloat(setting.value) : null
    const autoApproved = auth.role === 'admin' || (threshold !== null && data.amount <= threshold)
    const status = autoApproved ? 'approved' : 'pending'
    const debt = await db.debt.create({
      data: { churchId: auth.churchId, amount: data.amount, currency: data.currency, creditor: data.creditor, description: data.description ?? null, status, createdBy: auth.userId, approvedBy: autoApproved ? auth.userId : null },
    })
    if (status === 'pending') {
      const admins = await db.user.findMany({ where: { churchId: auth.churchId, role: 'admin', isActive: true }, select: { id: true } })
      await Promise.all(admins.map(a => db.notification.create({ data: { churchId: auth.churchId, userId: a.id, title: "Approbation requise", message: `Dette de ${data.amount} ${data.currency} en attente d'approbation.`, type: 'warning' } })))
    }
    createAuditLog({ churchId: auth.churchId, userId: auth.userId, action: 'debt_created', details: `${data.amount} ${data.currency} — ${data.creditor} — ${status}` })
    return Response.json({ debt, autoApproved }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Validation', details: e.issues }, { status: 400 })
    console.error('Debts POST:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })
    const body = await req.json()
    const data = approveSchema.parse(body)
    const existing = await db.debt.findFirst({ where: { id: data.debtId, churchId: auth.churchId } })
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'pending') return Response.json({ error: 'Not pending' }, { status: 409 })
    const debt = await db.debt.update({ where: { id: data.debtId }, data: { status: data.action, approvedBy: auth.userId, approvalComment: data.comment ?? null } })
    const label = data.action === 'approved' ? 'approuvée ✅' : 'rejetée ❌'
    await db.notification.create({ data: { churchId: auth.churchId, userId: existing.createdBy, title: `Dette ${label}`, message: `${existing.amount} ${existing.currency} — ${label}${data.comment ? '. ' + data.comment : ''}`, type: data.action === 'approved' ? 'success' : 'error' } })
    createAuditLog({ churchId: auth.churchId, userId: auth.userId, action: `debt_${data.action}`, details: `ID: ${data.debtId}${data.comment ? ' — ' + data.comment : ''}` })
    return Response.json({ debt })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Validation', details: e.issues }, { status: 400 })
    console.error('Debts PATCH:', e)
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
    const existing = await db.debt.findFirst({ where: { id, churchId: auth.churchId } })
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })
    await db.debtPayment.deleteMany({ where: { debtId: id } })
    await db.debt.delete({ where: { id } })
    createAuditLog({ churchId: auth.churchId, userId: auth.userId, action: 'debt_deleted', details: `ID: ${id}` })
    return Response.json({ success: true })
  } catch (e) {
    console.error('Debts DELETE:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
