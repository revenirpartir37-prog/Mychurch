import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const schema = z.object({ logo: z.string().url().nullable() })

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const auth = await verifyAccessToken(token)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const data = schema.parse(body)

    await db.church.update({
      where: { id: auth.churchId },
      data: { logo: data.logo },
    })

    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'update_church_logo',
      details: 'Logo de l\'église mis à jour',
    })

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Church logo POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
