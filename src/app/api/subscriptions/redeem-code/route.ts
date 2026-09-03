import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { z } from 'zod'

const redeemCodeSchema = z.object({
  code: z.string().min(1, 'Le code administrateur est requis'),
})

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
    const auth = await verifyAccessToken(token)
    if (!auth) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { code } = redeemCodeSchema.parse(body)

    const expectedAdminCode = process.env.ADMIN_LIFETIME_CODE?.trim()

    if (!expectedAdminCode || code.trim() !== expectedAdminCode) {
      return Response.json({ error: 'Code administrateur invalide ou non reconnu' }, { status: 400 })
    }

    // Désactiver les anciens abonnements de cette église
    await db.subscription.updateMany({
      where: {
        churchId: auth.churchId,
        status: 'active',
      },
      data: { status: 'expired' },
    })

    // Créer l'abonnement à vie (valable jusqu'en 2099)
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
      message: 'Abonnement à vie activé avec succès pour votre église !',
      subscription,
    })
  } catch (error: any) {
    console.error('Redeem admin code error:', error)
    const message = error.errors?.[0]?.message || error.message || 'Erreur lors de la validation du code'
    return Response.json({ error: message }, { status: 400 })
  }
}
