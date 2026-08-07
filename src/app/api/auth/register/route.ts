import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'
import { createSupabaseUser } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/emails'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { NextRequest } from 'next/server'

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  churchName: z.string().min(1, 'Church name is required'),
  churchEmail: z.string().email('Invalid church email'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province is required'),
  country: z.string().min(1, 'Country is required'),
  currency: z.enum(['USD', 'FC', 'EUR']).default('USD'),
  initialCapital: z.coerce.number().default(0),
  firebaseUid: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = registerSchema.parse(body)

    // Check if church email already exists
    const existingChurch = await db.church.findUnique({ where: { email: data.churchEmail } })
    if (existingChurch) {
      return Response.json({ error: 'A church with this email already exists' }, { status: 409 })
    }

    // Créer l'utilisateur Supabase Auth (source d'identité) AVANT le user DB.
    const supabaseUid = await createSupabaseUser(data.email, data.password)

    // Garde un hash bcrypt dans la DB pour respecter le champ non-null requirable
    const passwordHash = await bcrypt.hash(data.password, 10)

    // Create church
    const church = await db.church.create({
      data: {
        name: data.churchName,
        email: data.churchEmail,
        phone: data.phone || null,
        address: data.address,
        city: data.city,
        province: data.province,
        country: data.country,
        currency: data.currency,
        initialCapital: data.initialCapital,
      },
    })

    // Create first admin user (auto-verified on registration)
    const user = await db.user.create({
      data: {
        churchId: church.id,
        email: data.email,
        passwordHash,
        firebaseUid: data.firebaseUid || supabaseUid,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        role: 'admin',
        verified: true,
      },
    })

    // Create trial subscription (30 days)
    const trialEndDate = new Date()
    trialEndDate.setDate(trialEndDate.getDate() + 30)
    await db.subscription.create({
      data: {
        churchId: church.id,
        plan: 'trial',
        status: 'active',
        startDate: new Date(),
        endDate: trialEndDate,
        amount: 0,
        currency: data.currency,
        paymentStatus: 'completed',
      },
    })

    // Create default church settings
    const defaultSettings = [
      { key: 'primaryColor', value: '#6366f1' },
      { key: 'secondaryColor', value: '#8b5cf6' },
      { key: 'currencySymbol', value: '$' },
      { key: 'dateFormat', value: 'MM/dd/yyyy' },
      { key: 'timeFormat', value: '12h' },
      { key: 'language', value: 'en' },
      { key: 'theme', value: 'light' },
    ]
    await db.churchSetting.createMany({
      data: defaultSettings.map((s) => ({ churchId: church.id, ...s })),
    })

    // Generate JWT tokens for direct login
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
      action: 'register',
      details: `Inscription de l'église "${church.name}" par ${data.firstName} ${data.lastName} (${data.email})`,
    })

    // Email de bienvenue avec les identifiants (non bloquant)
    sendWelcomeEmail({
      to: data.email,
      firstName: data.firstName,
      churchName: church.name,
      email: data.email,
      password: data.password,
    }).catch((e) => console.error('Welcome email failed:', e))

    return Response.json({
      user: userWithoutPassword,
      church,
      token,
      refreshToken,
      message: 'Registration successful',
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Registration validation failed:', error.issues)
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Registration error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}