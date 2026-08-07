import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  return await verifyAccessToken(token)
}

function generateSlug(): string {
  return randomBytes(4).toString('hex')
}

// GET /api/churches/registration-link
// Returns the unique registration link for the church (generates it if missing).
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let church = await db.church.findUnique({ where: { id: auth.churchId } })
    if (!church) {
      return Response.json({ error: 'Church not found' }, { status: 404 })
    }

    if (!church.registrationSlug) {
      let slug = generateSlug()
      let isUnique = false
      let attempts = 0
      while (!isUnique && attempts < 10) {
        const exists = await db.church.findUnique({ where: { registrationSlug: slug } })
        if (!exists) {
          isUnique = true
        } else {
          slug = generateSlug()
          attempts++
        }
      }
      church = await db.church.update({
        where: { id: auth.churchId },
        data: { registrationSlug: slug },
      })
    }

    const origin =
      request.headers.get('origin') ||
      request.headers.get('x-forwarded-host') ||
      (typeof window !== 'undefined' ? window.location.origin : '')

    const baseUrl = origin
      ? origin.startsWith('http') ? origin : `https://${origin}`
      : 'https://mychurch.app'

    return Response.json({
      slug: church.registrationSlug,
      url: `${baseUrl}/join/${church.registrationSlug}`,
    })
  } catch (error) {
    console.error('Registration-link GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
