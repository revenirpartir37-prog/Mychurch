import { Resend } from 'resend'

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

function layout(title: string, subtitle: string, body: string): string {
  return `
    <div style="max-width: 480px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f9fafb; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 2px;">MYCHURCH</h1>
        <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 14px;">${subtitle}</p>
      </div>
      <div style="padding: 32px 24px;">
        ${body}
      </div>
      <div style="background: #f3f4f6; padding: 16px 24px; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 11px;">
          &copy; ${new Date().getFullYear()} MYCHURCH. Created by Henock Aduma.
        </p>
      </div>
    </div>
  `
}

// Email de bienvenue diplomatique l'utilisateur avec ses identifiants de connexion.
export async function sendWelcomeEmail(input: {
  to: string
  firstName: string
  churchName: string
  email: string
  password: string
}) {
  const body = `
    <p style="margin: 0 0 8px 0; color: #374151; font-size: 16px;">Bonjour ${input.firstName},</p>
    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Votre compte <strong style="color: #1f2937;">${input.churchName}</strong> a été créé avec succès sur <strong>MYCHURCH</strong>.
      Voici vos identifiants de connexion :
    </p>
    <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; margin: 0 0 24px 0;">
      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">Adresse email :</p>
      <p style="margin: 0 0 16px 0; color: #1e40af; font-size: 16px; font-weight: 700;">${input.email}</p>
      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">Mot de passe :</p>
      <code style="background: #1e40af; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 15px; font-weight: 700;">${input.password}</code>
    </div>
    <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
      Pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe après votre première connexion depuis les paramètres du compte.
    </p>
    <p style="margin: 0; color: #6b7280; font-size: 13px;">Cordialement,<br/>L'équipe MYCHURCH</p>
  `
  const resend = getResend()
  if (!resend) {
    console.log(`[WelcomeEmail] ${input.email} (Resend non configuré)`)
    return
  }
  await resend.emails.send({
    from: 'MYCHURCH <onboarding@resend.dev>',
    to: input.to,
    subject: `MYCHURCH - Bienvenue sur ${input.churchName}`,
    html: layout('Bienvenue', 'Vos accès à votre compte', body),
  })
}

// Email de réinitialisation du mot de passe (code OTP).
export async function sendPasswordResetEmail(email: string, otpCode: string, churchName: string) {
  const body = `
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
    <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px;">
      Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
    </p>
  `
  const resend = getResend()
  if (!resend) {
    console.log(`[ResetEmail] ${email} (Resend non configuré)`)
    return
  }
  await resend.emails.send({
    from: 'MYCHURCH <onboarding@resend.dev>',
    to: email,
    subject: 'MYCHURCH - Réinitialisation du mot de passe',
    html: layout('Réinitialisation', 'Code de réinitialisation', body),
  })
}