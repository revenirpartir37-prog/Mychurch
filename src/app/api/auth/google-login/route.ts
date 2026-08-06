import { db } from '@/lib/db'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'
import { z } from 'zod'
import { NextRequest } from 'next/server'

const googleLoginSchema = z.object({
  firebaseUid: z.string().min(1, 'Firebase UID is required'),
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  churchEmail: z.string().email('Invalid church email'),
  role: z.enum(['admin', 'treasurer', 'secretary', 'reader'], { message: 'Invalid role' }),
  photoUrl: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = googleLoginSchema.parse(body)

    // Find church by churchEmail
    const church = await db.church.findUnique({ where: { email: data.churchEmail } })
    if (!church) {
      return Response.json({ error: 'Church not found' }, { status: 404 })
    }

    if (!church.isActive) {
      return Response.json({ error: 'Church account is deactivated' }, { status: 403 })
    }

    // Find user by email + churchId + role
    const user = await db.user.findFirst({
      where: {
        email: data.email,
        churchId: church.id,
        role: data.role,
      },
    })

    if (!user) {
      return Response.json({
        error: 'No account found. Please register first.',
        needsRegistration: true,
      }, { status: 404 })
    }

    if (!user.isActive) {
      return Response.json({ error: 'User account is deactivated' }, { status: 403 })
    }

    // Update firebaseUid and set verified to true
    await db.user.update({
      where: { id: user.id },
      data: {
        firebaseUid: data.firebaseUid,
        verified: true,
        lastLogin: new Date(),
      },
    })

    // Check subscription status
    const subscription = await db.subscription.findFirst({
      where: {
        churchId: church.id,
      },
      orderBy: { createdAt: 'desc' },
    })

    const isSubscriptionExpired = !subscription ||
      subscription.status !== 'active' ||
      subscription.endDate < new Date()

    // Generate JWT tokens
    const payload = {
      userId: user.id,
      churchId: church.id,
      email: user.email,
      role: user.role,
      churchName: church.name,
    }
    const token = await generateAccessToken(payload)
    const refreshToken = await generateRefreshToken(user.id)

    // Return user without passwordHash
    const { passwordHash: _, ...userWithoutPassword } = user

    return Response.json({
      user: userWithoutPassword,
      church,
      token,
      refreshToken,
      subscription,
      subscriptionStatus: isSubscriptionExpired ? 'expired' : 'active',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Google login error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}