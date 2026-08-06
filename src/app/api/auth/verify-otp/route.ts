import { db } from '@/lib/db'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'
import { z } from 'zod'
import { NextRequest } from 'next/server'

const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'OTP code must be 6 digits'),
  purpose: z.string().default('verification'),
  churchId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = verifyOtpSchema.parse(body)

    // Find the latest unexpired, unverified OTP for that email with matching purpose
    const otp = await db.otp.findFirst({
      where: {
        email: data.email,
        purpose: data.purpose,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otp) {
      return Response.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    // Rate limiting: check attempts
    if (otp.attempts >= 5) {
      // Delete this OTP since it's maxed out
      await db.otp.delete({ where: { id: otp.id } })
      return Response.json({ error: 'Too many attempts. Please request a new OTP.' }, { status: 429 })
    }

    // Increment attempts
    await db.otp.update({
      where: { id: otp.id },
      data: { attempts: otp.attempts + 1 },
    })

    // Check if code matches
    if (otp.code !== data.code) {
      const remainingAttempts = 5 - (otp.attempts + 1)
      return Response.json({
        error: `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`,
        remainingAttempts,
      }, { status: 400 })
    }

    // Code matches - mark OTP as verified
    await db.otp.update({
      where: { id: otp.id },
      data: { verified: true },
    })

    // Mark user as verified
    let user: any = null
    let church: any = null
    if (otp.userId) {
      user = await db.user.update({
        where: { id: otp.userId },
        data: { verified: true },
      })
      if (user?.churchId) {
        church = await db.church.findUnique({ where: { id: user.churchId } })
      }
    }

    // Delete all OTPs for that email (cleanup)
    await db.otp.deleteMany({
      where: { email: data.email },
    })

    // If we have a user and church, generate JWT tokens for direct dashboard login
    if (user && church && data.purpose === 'verification') {
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
        success: true,
        message: 'Email verified successfully',
        directLogin: true,
        token,
        refreshToken,
        user: userWithoutPassword,
        church,
      })
    }

    return Response.json({
      success: true,
      message: 'Email verified successfully',
      directLogin: false,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Verify OTP error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}