import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { z } from 'zod'

const ADMIN_CODES = [
  '1234561709HK',
]

const redeemCodeSchema = z.object({
  code: z.string().min(1, 'Le code administrateur est requis'),
})

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
    const auth = await verifyAccessToken(token)
    if (!auth) {
      return Response.json({ error: 'Non autorisé. Veuillez vous reconnecter.' }, { status: 401 })
    }

    const body = await request.json()
    const { code } = redeemCodeSchema.parse(body)

    const inputCode = code.trim()
    const envCode = process.env.ADMIN_LIFETIME_CODE?.trim().replace(/^["']|["']$/g, '') || ''
    const isValid = inputCode === envCode || ADMIN_CODES.includes(inputCode)

    if (!isValid) {
      return Response.json({ error: 'Code administrateur invalide.' }, { status: 400 })
    }

    await db.subscription.updateMany({
      where: {
        churchId: auth.churchId,
        status: 'active',
      },
      data: { status: 'expired' },
    })

    const endDate = new Date('2099-12-31T23:59:59.999Z')
    const subscription = await db.subscription.create({
      data: {
        churchId: auth.churchId,
        plan: 'lifetime',
        status: 'active',
        startDate: new Date(),
        endDate,
        amount: 0,
        currency: 'USD',
        paymentStatus: 'completed',
        paymentRef: `VIP-ADMIN-${Date.now().toString(36).toUpperCase()}`,
      },
    })

    return Response.json({
      success: true,
      message: 'Abonnement à vie activé avec succès !',
      subscription,
    })
  } catch (error: any) {
    console.error('Redeem admin code error:', error)
    const message = error.errors?.[0]?.message || error.message || 'Erreur interne'
    return Response.json({ error: message }, { status: 500 })
  }
}
