import { SignJWT, jwtVerify } from 'jose'

const FALLBACK_JWT_SECRET = 'mC9f2kA8vN3pQ7xR4wE6jY1hT5bG0dL2sF8uM3nK9cW4eJ7rA2qZ6oP1iX5hV0b'
const FALLBACK_JWT_REFRESH = 'aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8gH9iJ0kL1mN2oP3'

function getSecret(name: string, fallback: string): Uint8Array {
  const value = process.env[name] || fallback
  if (!value || value.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters`)
  }
  return new TextEncoder().encode(value)
}

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
    .sign(getSecret('JWT_SECRET', FALLBACK_JWT_SECRET))
}

export async function generateRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret('JWT_REFRESH_SECRET', FALLBACK_JWT_REFRESH))
}

export function isJwtExpired(token: string | null): boolean {
  if (!token) return true
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    // Compatible Node.js 16+ (atob) and older (Buffer)
    let decoded: string
    if (typeof atob !== 'undefined') {
      decoded = atob(base64)
    } else {
      decoded = Buffer.from(base64, 'base64').toString('utf-8')
    }
    const payload = JSON.parse(decoded)
    if (!payload.exp) return false
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  if (!token || typeof token !== 'string' || token === 'null' || token === 'undefined' || token.trim() === '') {
    return null
  }
  if (isJwtExpired(token)) return null
  try {
    const { payload } = await jwtVerify(token.trim(), getSecret('JWT_SECRET', FALLBACK_JWT_SECRET))
    if (!payload || !payload.userId || !payload.churchId) return null
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret('JWT_REFRESH_SECRET', FALLBACK_JWT_REFRESH))
    return payload as unknown as { userId: string }
  } catch {
    return null
  }
}