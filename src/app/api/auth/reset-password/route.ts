import { db } from '@/lib/db'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import { updateSupabasePassword } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'OTP code must be 6 digits'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = resetPasswordSchema.parse(body)

    // Verify OTP code exists and is verified for this email
    const otp = await db.otp.findFirst({
      where: {
        email: data.email,
        code: data.code,
        purpose: 'password_reset',
        verified: true,
        expiresAt: { gte: new Date() },
      },
    })

    if (!otp) {
      return Response.json({ error: 'Code de vérification invalide ou expiré' }, { status: 400 })
    }

    // Find the user by email
    const user = await db.user.findFirst({
      where: { email: data.email },
    })

    if (!user) {
      return Response.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Mettre à jour le mot de passe côté Supabase Auth (source d'identité)
    await updateSupabasePassword(user.email, data.newPassword)

    // Sync du hash local (champ requis par le schéma, non utilisé pour le login)
    const passwordHash = await bcrypt.hash(data.newPassword, 10)
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    // Clean up used OTP
    await db.otp.deleteMany({ where: { email: data.email, purpose: 'password_reset' } })

    return Response.json({ success: true, message: 'Mot de passe réinitialisé avec succès' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Reset password error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
