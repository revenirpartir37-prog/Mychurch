import { db } from '@/lib/db'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import { Resend } from 'resend'

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  purpose: z.enum(['verification', 'password_reset']).default('verification'),
})

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendOtpEmail(email: string, otpCode: string, churchName: string, purpose: string) {
  const subject = purpose === 'password_reset'
    ? 'MYCHURCH - Réinitialisation du mot de passe'
    : 'MYCHURCH - Code de vérification OTP'

  const descriptionText = purpose === 'password_reset'
    ? 'Votre code de réinitialisation du mot de passe est :'
    : `Votre code de vérification pour l'église <strong style="color: #1f2937;">${churchName}</strong> est :`

  const html = `
    <div style="max-width: 480px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f9fafb; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 2px;">MYCHURCH</h1>
        <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 14px;">Code de vérification OTP</p>
      </div>
      <div style="padding: 32px 24px;">
        <p style="margin: 0 0 8px 0; color: #374151; font-size: 16px;">Bonjour,</p>
        <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
          ${descriptionText}
        </p>
        <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e40af;">${otpCode}</span>
        </div>
        <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
          Ce code expire dans <strong style="color: #dc2626;">10 minutes</strong>. Ne le partagez avec personne.
        </p>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
            Si vous n'avez pas demandé ce code, ignorez cet email.
          </p>
        </div>
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
      subject,
      html,
    })
  } else {
    console.log(`[OTP] Code ${otpCode} pour ${email} (Resend non configuré)`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = sendOtpSchema.parse(body)

    // Find the user to get churchId for church name
    const user = await db.user.findFirst({
      where: { email: data.email },
      include: { church: true },
    })

    const churchName = user?.church?.name || 'MYCHURCH'

    // Delete any existing unverified OTPs for this email and purpose
    await db.otp.deleteMany({
      where: {
        email: data.email,
        purpose: data.purpose,
        verified: false,
      },
    })

    // Generate new OTP
    const otpCode = generateOtpCode()
    const otpExpiresAt = new Date()
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10)

    await db.otp.create({
      data: {
        churchId: user?.churchId || null,
        userId: user?.id || null,
        email: data.email,
        code: otpCode,
        purpose: data.purpose,
        expiresAt: otpExpiresAt,
      },
    })

    // Send OTP via Resend
    try {
      await sendOtpEmail(data.email, otpCode, churchName, data.purpose)
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError)
    }

    return Response.json({
      success: true,
      message: 'OTP sent',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Send OTP error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}