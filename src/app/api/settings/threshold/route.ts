import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const thresholdSchema = z.object({
  debt_threshold_usd: z.coerce.number().min(0),
  debt_threshold_cdf: z.coerce.number().min(0),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await db.churchSetting.findMany({
      where: {
        churchId: auth.churchId,
        key: { in: ['debt_threshold_usd', 'debt_threshold_cdf'] }
      }
    })

    const usdSetting = settings.find(s => s.key === 'debt_threshold_usd')
    const cdfSetting = settings.find(s => s.key === 'debt_threshold_cdf')

    return Response.json({
      debt_threshold_usd: usdSetting ? parseFloat(usdSetting.value) : 0,
      debt_threshold_cdf: cdfSetting ? parseFloat(cdfSetting.value) : 0,
    })
  } catch (e) {
    console.error('Threshold GET error:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const data = thresholdSchema.parse(body)

    await db.$transaction([
      db.churchSetting.upsert({
        where: { churchId_key: { churchId: auth.churchId, key: 'debt_threshold_usd' } },
        update: { value: String(data.debt_threshold_usd) },
        create: { churchId: auth.churchId, key: 'debt_threshold_usd', value: String(data.debt_threshold_usd) }
      }),
      db.churchSetting.upsert({
        where: { churchId_key: { churchId: auth.churchId, key: 'debt_threshold_cdf' } },
        update: { value: String(data.debt_threshold_cdf) },
        create: { churchId: auth.churchId, key: 'debt_threshold_cdf', value: String(data.debt_threshold_cdf) }
      })
    ])

    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'settings_update',
      details: `Seuils d'approbation mis à jour: ${data.debt_threshold_usd} USD, ${data.debt_threshold_cdf} CDF`
    })

    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: e.issues }, { status: 400 })
    }
    console.error('Threshold POST error:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
