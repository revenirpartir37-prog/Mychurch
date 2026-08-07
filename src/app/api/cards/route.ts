import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import QRCode from 'qrcode'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

function generateCardNumber(): string {
  const now = new Date()
  const dateStr =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const random = String(Math.floor(1000 + Math.random() * 9000))
  return `MC-${dateStr}-${random}`
}

// GET: List member cards for church
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { churchId: auth.churchId }
    if (memberId) where.memberId = memberId

    const [cards, total] = await Promise.all([
      db.memberCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          member: { select: { id: true, firstName: true, lastName: true, photo: true, department: true } },
        },
      }),
      db.memberCard.count({ where }),
    ])

    return Response.json({
      cards,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Cards GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Generate member card (requires payment verification)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { memberId } = z.object({ memberId: z.string().min(1, 'Member ID is required') }).parse(body)

    // Verify member belongs to this church
    const member = await db.member.findFirst({
      where: { id: memberId, churchId: auth.churchId },
    })
    if (!member) {
      return Response.json({ error: 'Member not found' }, { status: 404 })
    }

    // Check for existing card
    const existingCard = await db.memberCard.findFirst({
      where: { memberId, churchId: auth.churchId },
    })
    if (existingCard) {
      return Response.json({ error: 'Member already has a card' }, { status: 409 })
    }

    // Generate unique card number
    let cardNumber = generateCardNumber()
    let isUnique = false
    let attempts = 0
    while (!isUnique && attempts < 10) {
      const exists = await db.memberCard.findUnique({ where: { cardNumber } })
      if (!exists) {
        isUnique = true
      } else {
        cardNumber = generateCardNumber()
        attempts++
      }
    }
    if (!isUnique) {
      return Response.json({ error: 'Failed to generate unique card number' }, { status: 500 })
    }

    // Generate QR code with card data
    const qrData = JSON.stringify({
      cardNumber,
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`,
      churchId: auth.churchId,
      churchName: auth.churchName,
    })

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })

    // Create the member card
    const card = await db.memberCard.create({
      data: {
        churchId: auth.churchId,
        memberId,
        cardNumber,
        qrCode: qrCodeDataUrl,
        isPaid: true,
        paidAmount: 0,
        paymentRef: 'free',
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, photo: true, department: true } },
      },
    })

    return Response.json({ card }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Cards POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}