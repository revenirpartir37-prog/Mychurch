import { db } from '@/lib/db'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import { Resend } from 'resend'

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendPasswordResetEmail(email: string, otpCode: string, churchName: string) {
  const html = `
    <div style="max-width: 480px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f9fafb; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 2px;">MYCHURCH</h1>
        <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 14px;">Réinitialisation du mot de passe</p>
      </div>
      <div style="padding: 32px 24px;">
        <p style="margin: 0 0 8px 0; color: #374151; font-size: 16px;">Bonjour,</p>
        <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
          Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte lié à l'église <strong style="color: #1f2937;">${churchName}</strong>.
        </p>
        <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Votre code de réinitialisation :</p>
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e40af;">${otpCode}</span>
        </div>
        <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
          Ce code expire dans <strong style="color: #dc2626;">10 minutes</strong>. Ne le partagez avec personne.
        </p>
        <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
          Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
        </p>
      </div>
      <div style="background: #f3f4f6; padding: 16px 24px; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 11px;">
          &copy; ${new Date().getFullYear()} MYCHURCH. Created by Henock Aduma.
        </p>
      </div>
    </div>
  `

  const resendClient = getResend()
  if (resendClient) {
    await resendClient.emails.send({
      from: 'MYCHURCH <onboarding@resend.dev>',
      to: email,
      subject: 'MYCHURCH - Réinitialisation du mot de passe',
      html,
    })
  } else {
    console.log(`[OTP] Reset code pour ${email} (Resend non configuré)`)
  }
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