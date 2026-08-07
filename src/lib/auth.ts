import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'mychurch-super-secret-key-change-in-production-2024')
const REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || 'mychurch-refresh-secret-key-change-in-production-2024')

export interface JWTPayload {
  userId: string
  churchId: string
  email: string
  role: string
  churchName: string
}

export async function generateAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET)
}

export async function generateRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(REFRESH_SECRET)
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined' || token.trim() === '') {
    return null
  }
  try {
    const { payload } = await jwtVerify(token.trim(), JWT_SECRET)
    if (!payload || !payload.userId || !payload.churchId) return null
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET)
    return payload as unknown as { userId: string }
  } catch {
    return null
  }
}