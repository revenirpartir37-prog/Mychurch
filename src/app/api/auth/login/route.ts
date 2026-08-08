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

    // --- Password verification ---
    let passwordValid = false
    let supabaseUid: string | null = null

    // Step 1: Try Supabase Auth (completely safe — never throws to outer catch)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
        const { createClient } = await import('@supabase/supabase-js')
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
        })
        const { data: authData, error } = await client.auth.signInWithPassword({
          email: userEmail,
          password: data.password,
        })
        if (!error && authData?.user) {
          passwordValid = true
          supabaseUid = authData.user.id
        }
      }
    } catch {
      // Supabase unavailable — fall through to bcrypt
    }

    // Step 2: Fallback to bcrypt if Supabase didn't work
    if (!passwordValid) {
      try {
        passwordValid = await bcrypt.compare(data.password, user.passwordHash)
      } catch {
        passwordValid = false
      }
    }

    if (!passwordValid) {
      return Response.json({ error: 'Identifiants invalides' }, { status: 401 })
    }

    // Update Supabase UID (non-blocking)
    if (supabaseUid && supabaseUid !== user.firebaseUid) {
      db.user.update({ where: { id: user.id }, data: { firebaseUid: supabaseUid } }).catch(() => {})
    }

    // Check subscription status (non-blocking if fails)
    let subscription: Awaited<ReturnType<typeof db.subscription.findFirst>> = null
    try {
      subscription = await db.subscription.findFirst({
        where: { churchId: church.id },
        orderBy: { createdAt: 'desc' },
      })
    } catch {
      // Non-blocking
    }

    const isSubscriptionExpired =
      !subscription ||
      subscription.status !== 'active' ||
      subscription.endDate < new Date()

    // Update last login (non-blocking)
    db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch(() => {})

    // Generate JWT tokens
    const payload = {
      userId: user.id,
      churchId: church.id,
      email: user.email,
      role: user.role,
      churchName: church.name,
    }
    const [token, refreshToken] = await Promise.all([
      generateAccessToken(payload),
      generateRefreshToken(user.id),
    ])

    // Return user without passwordHash
    const { passwordHash: _, ...userWithoutPassword } = user

    // Log audit (non-blocking)
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
      return Response.json(
        { error: 'Données de formulaire invalides', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Login error:', error)
    return Response.json({ error: 'Identifiants invalides ou erreur de connexion' }, { status: 500 })
  }
}