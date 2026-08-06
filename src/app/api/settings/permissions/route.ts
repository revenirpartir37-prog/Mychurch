import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  return verifyAccessToken(token)
}
import { createAuditLog } from '@/lib/audit'
import { DEFAULT_PERMISSIONS, getRolePermissions } from '@/lib/rbac'
import { z } from 'zod'

const rbacUpdateSchema = z.object({
  role: z.enum(['treasurer', 'secretary', 'reader']),
  permissions: z.array(z.string()),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Return the current permissions for all roles
    const roles = ['treasurer', 'secretary', 'reader'] as const
    const permissionsMap: Record<string, string[]> = {}

    for (const role of roles) {
      permissionsMap[role] = await getRolePermissions(auth.churchId, role)
    }

    // Include defaults for comparison
    return Response.json({
      custom: permissionsMap,
      defaults: DEFAULT_PERMISSIONS
    })
  } catch (e) {
    console.error('Permissions GET error:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (auth.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const data = rbacUpdateSchema.parse(body)

    await db.churchSetting.upsert({
      where: { churchId_key: { churchId: auth.churchId, key: `rbac:${data.role}` } },
      update: { value: JSON.stringify(data.permissions) },
      create: { churchId: auth.churchId, key: `rbac:${data.role}`, value: JSON.stringify(data.permissions) }
    })

    createAuditLog({
      churchId: auth.churchId,
      userId: auth.userId,
      action: 'rbac_update',
      details: `Permissions mises à jour pour le rôle ${data.role}`
    })

    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: e.issues }, { status: 400 })
    }
    console.error('Permissions POST error:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
