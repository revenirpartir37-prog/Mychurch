import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { createPayment, getPayment, usdToXof } from '@/lib/geniuspay'
import { z } from 'zod'
import { NextRequest } from 'next/server'
async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

const paymentSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  paymentMethod: z.enum(['airtel_money', 'mtn_money', 'orange_money', 'card', 'wave']).optional(),
})

// POST: Create payment for member card via GeniusPay
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = paymentSchema.parse(body)

    // Get user info for customer details
    const user = await db.user.findFirst({
      where: { id: auth.userId },
      select: { firstName: true, lastName: true, email: true },
    })
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Get member info
    const member = await db.member.findFirst({
      where: { id: data.memberId, churchId: auth.churchId },
      select: { firstName: true, lastName: true },
    })
    if (!member) {
      return Response.json({ error: 'Membre non trouvé' }, { status: 404 })
    }

    const usdAmount = 10
    const paymentAmount = usdAmount
    const paymentCurrency = 'USD'

    // Create payment via GeniusPay in USD
    const origin = request.headers.get('origin') || ''
    const paymentParams: any = {
      amount: paymentAmount,
      currency: paymentCurrency,
      description: `[10 $ USD] Carte membre - ${member.firstName} ${member.lastName}`,
      customer: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      success_url: `${origin}/?view=member-cards&payment=success`,
      error_url: `${origin}/?view=member-cards&payment=error`,
      callback_url: `${origin}/api/payments/webhook`,
      metadata: {
        churchId: auth.churchId,
        userId: auth.userId,
        paymentType: 'member_card',
        memberId: data.memberId,
      },
    }

    // Map payment method to GeniusPay gateway/provider
    if (data.paymentMethod) {
      if (data.paymentMethod === 'card') {
        paymentParams.gateway = 'paystack'
        paymentParams.payment_method = 'card'
      } else {
        paymentParams.gateway = 'pawapay'
        paymentParams.payment_method = 'pawapay'
        paymentParams.mmo_provider = data.paymentMethod
      }
    }

    const paymentResponse = await createPayment(paymentParams)

    if (!paymentResponse.success || !paymentResponse.data) {
      console.error('GeniusPay member-card error:', paymentResponse.error)
      return Response.json(
        { error: paymentResponse.error?.message || 'Failed to create payment' },
        { status: 400 }
      )
    }

    const paymentData = paymentResponse.data
    const paymentUrl = paymentData.checkout_url || paymentData.payment_url || ''
    const reference = paymentData.reference

    return Response.json({
      paymentUrl,
      reference,
      amount: paymentAmount,
      currency: paymentCurrency,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Member card payment POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Verify payment status for member card
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('reference')

    if (!reference) {
      return Response.json({ error: 'Reference required' }, { status: 400 })
    }

    try {
      const paymentResponse = await getPayment(reference)
      if (paymentResponse.success && paymentResponse.data?.status === 'completed') {
        return Response.json({ verified: true })
      }
    } catch {
      // GeniusPay API may fail in sandbox mode - treat as not verified
    }

    return Response.json({ verified: false })
  } catch (error) {
    console.error('Member card payment GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
