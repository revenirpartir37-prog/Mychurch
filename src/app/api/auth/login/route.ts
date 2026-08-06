import { db } from '@/lib/db'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { NextRequest } from 'next/server'

const loginSchema = z.object({
  churchEmail: z.string().email('Invalid church email'),
  role: z.enum(['admin', 'treasurer', 'secretary', 'reader'], { message: 'Invalid role' }),
  email: z.string().email('Invalid user email'),
  password: z.string().min(1, 'Password is required'),
  firebaseUid: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = loginSchema.parse(body)

    // Find church by email
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
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.isActive) {
      return Response.json({ error: 'User account is deactivated' }, { status: 403 })
    }

    // Verify password
    const isValid = await bcrypt.compare(data.password, user.passwordHash)
    if (!isValid) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }

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

    // Update firebaseUid if provided
    if (data.firebaseUid) {
      await db.user.update({
        where: { id: user.id },
        data: { firebaseUid: data.firebaseUid },
      })
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

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

    // Log audit
    createAuditLog({
      churchId: church.id,
      userId: user.id,
      action: 'login',
      details: `Connexion réussie pour ${user.email} (${user.role})`,
    })

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
    console.error('Login error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}