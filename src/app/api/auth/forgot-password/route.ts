import { db } from '@/lib/db'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import { sendPasswordResetEmail } from '@/lib/emails'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = forgotPasswordSchema.parse(body)

    // Find user by email (across all churches)
    const user = await db.user.findFirst({
      where: {
        email: data.email,
      },
      include: {
        church: true,
      },
    })

    // Always return success to avoid revealing if user exists
    if (!user) {
      return Response.json({
        success: true,
        message: 'If an account exists, a reset code has been sent.',
      })
    }

    // Delete any existing password_reset OTPs for this email
    await db.otp.deleteMany({
      where: {
        email: data.email,
        purpose: 'password_reset',
        verified: false,
      },
    })

    // Generate new OTP
    const otpCode = generateOtpCode()
    const otpExpiresAt = new Date()
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10)

    await db.otp.create({
      data: {
        churchId: user.churchId,
        userId: user.id,
        email: data.email,
        code: otpCode,
        purpose: 'password_reset',
        expiresAt: otpExpiresAt,
      },
    })

    // Send reset OTP via Resend
    try {
      await sendPasswordResetEmail(data.email, otpCode, user.church.name)
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError)
    }

    return Response.json({
      success: true,
      message: 'If an account exists, a reset code has been sent.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Forgot password error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}