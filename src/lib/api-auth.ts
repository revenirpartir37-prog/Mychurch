import { NextRequest } from 'next/server'
import { verifyAccessToken, type JWTPayload } from '@/lib/auth'

export async function requireAuth(request: NextRequest, roles?: readonly string[]): Promise<JWTPayload | null> {
  const header = request.headers.get('authorization')
  const token = header?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload?.userId || !payload.churchId) return null
  if (roles && !roles.includes(payload.role)) return null
  return payload
}

export function canManageFinance(auth: JWTPayload): boolean {
  return auth.role === 'admin' || auth.role === 'treasurer'
}