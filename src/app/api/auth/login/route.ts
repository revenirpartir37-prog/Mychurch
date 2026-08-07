import { db } from '@/lib/db'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { verifySupabasePassword, createSupabaseUser } from '@/lib/supabase'
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

    const churchEmail = data.churchEmail.toLowerCase().trim()
    const userEmail = data.email.toLowerCase().trim()

    // Find church by email (case-insensitive)
    const church = await db.church.findFirst({
      where: { email: { equals: churchEmail, mode: 'insensitive' } },
    })
    if (!church) {
      return Response.json({ error: 'Église non trouvée avec cet email' }, { status: 404 })
    }

    if (!church.isActive) {
      return Response.json({ error: 'Le compte de cette église est désactivé' }, { status: 403 })
    }

    // Find user by email + churchId + role
    const user = await db.user.findFirst({
      where: {
        email: { equals: userEmail, mode: 'insensitive' },
        churchId: church.id,
        role: data.role,
      },
    })

    if (!user) {
      return Response.json({ error: 'Identifiants invalides ou rôle incorrect' }, { status: 401 })
    }

    if (!user.isActive) {
      return Response.json({ error: 'Ce compte utilisateur est désactivé' }, { status: 403 })
    }

    let supabaseUid: string | null = null
    // Verify password via Supabase Auth first
    try {
      supabaseUid = await verifySupabasePassword(user.email, data.password)
    } catch {
      // Fallback: user was created via users-management or Supabase Auth unavailable.
      // Check the local bcrypt hash.
      const bcryptOk = await bcrypt.compare(data.password, user.passwordHash).catch(() => false)
      if (!bcryptOk) {
        return Response.json({ error: 'Identifiants invalides' }, { status: 401 })
      }
      // Password is valid locally — attempt to create Supabase Auth user non-blockingly
      try {
        supabaseUid = await createSupabaseUser(user.email, data.password)
      } catch {
        supabaseUid = null
      }
    }

    if (supabaseUid) {
      try {
        await db.user.update({ where: { id: user.id }, data: { firebaseUid: supabaseUid } })
      } catch {
        // Ignore update failure
      }
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

    // Update last login
    try {
      await db.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      })
    } catch {
      // Non-blocking
    }

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
      return Response.json({ error: 'Données de formulaire invalides', details: error.issues }, { status: 400 })
    }
    console.error('Login error:', error)
    return Response.json({ error: 'Erreur interne du serveur lors de la connexion' }, { status: 500 })
  }
}