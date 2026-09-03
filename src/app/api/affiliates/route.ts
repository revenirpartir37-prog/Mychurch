import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

function generateAffiliationCode(): string {
  return 'AFF-' + randomBytes(4).toString('hex').toUpperCase()
}

// GET: Liste des églises affiliées et lien d'invitation du Siège
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let church = await db.church.findUnique({
      where: { id: auth.churchId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!church) {
      return Response.json({ error: 'Church not found' }, { status: 404 })
    }

    // Si c'est une extension, elle n'a pas d'églises affiliées à administrer
    if (church.parentId) {
      return Response.json({
        isBranch: true,
        isHeadquarters: false,
        affiliates: [],
        affiliationCode: null,
      })
    }

    // Assurer l'existence d'un code d'affiliation pour le Siège
    if (!church.affiliationCode) {
      const code = generateAffiliationCode()
      church = await db.church.update({
        where: { id: auth.churchId },
        data: {
          affiliationCode: code,
          isHeadquarters: true,
        },
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })
    }

    const branches = await db.church.findMany({
      where: { parentId: auth.churchId },
      include: {
        _count: {
          select: {
            members: true,
            users: true,
            memberCards: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        users: {
          where: { role: 'admin' },
          select: { firstName: true, lastName: true, email: true, phone: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'https://mychurch-taupe.vercel.app'
    const affiliationUrl = `${origin}/affiliate/${church.affiliationCode}`

    const now = new Date()
    const mappedBranches = branches.map((b) => {
      const sub = b.subscriptions[0] || null
      const isExpired = !sub || sub.status !== 'active' || new Date(sub.endDate) < now
      return {
        id: b.id,
        name: b.name,
        city: b.city,
        country: b.country,
        email: b.email,
        phone: b.phone,
        memberCount: b._count.members,
        cardCount: b._count.memberCards,
        userCount: b._count.users,
        adminUser: b.users[0] || null,
        createdAt: b.createdAt,
        subscription: sub,
        isExpired,
      }
    })

    const currentSub = church.subscriptions[0] || null
    const isHeadquartersExpired =
      !currentSub ||
      currentSub.status !== 'active' ||
      currentSub.plan === 'trial' ||
      new Date(currentSub.endDate) < now

    return Response.json({
      isBranch: false,
      isHeadquarters: true,
      affiliationCode: church.affiliationCode,
      affiliationUrl,
      isHeadquartersExpired,
      affiliates: mappedBranches,
    })
  } catch (error) {
    console.error('Affiliates GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Régénérer un nouveau code d'affiliation
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const church = await db.church.findUnique({
      where: { id: auth.churchId },
      include: {
        subscriptions: {
          where: { status: 'active', paymentStatus: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!church || church.parentId) {
      return Response.json({ error: 'Seule une église mère peut générer un code d\'affiliation' }, { status: 403 })
    }

    const currentSub = church.subscriptions[0]
    const isExpired = !currentSub || currentSub.plan === 'trial' || new Date(currentSub.endDate) < new Date()
    if (isExpired) {
      return Response.json({
        error: 'Le système d\'affiliation n\'est pas disponible pendant l\'essai gratuit. Vous devez souscrire à l\'abonnement Siège (50 $ par mois ou 100 $ par an).',
      }, { status: 403 })
    }

    const newCode = generateAffiliationCode()
    const updated = await db.church.update({
      where: { id: auth.churchId },
      data: { affiliationCode: newCode, isHeadquarters: true },
    })

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'https://mychurch-taupe.vercel.app'

    return Response.json({
      affiliationCode: updated.affiliationCode,
      affiliationUrl: `${origin}/affiliate/${updated.affiliationCode}`,
    })
  } catch (error) {
    console.error('Affiliates POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
