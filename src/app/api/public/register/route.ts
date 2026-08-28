import { db } from '@/lib/db'
import { z } from 'zod'
import { notifyChurchUsers } from '@/lib/notification-dispatch'
import { rateLimit, getClientKey } from '@/lib/rate-limit'

const publicRegisterSchema = z.object({
  slug: z.string().min(1),
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  type: z.enum(['member', 'personnel']),
  phone: z.string().min(1, 'Le téléphone est requis'),
  email: z.string().email('Email invalide').optional().nullable().or(z.literal('')),
  address: z.string().min(1, 'L\'adresse est requise'),
  department: z.string().min(1, 'Le département est requis'),
  function: z.string().min(1, 'La fonction est requise'),
  emergencyContactName: z.string().min(1, 'Le contact d\'urgence (nom) est requis'),
  emergencyContactPhone: z.string().min(1, 'Le téléphone d\'urgence est requis'),
  photo: z.string().optional().nullable(),
})

// POST /api/public/register
// Public self-registration for members via the church's unique link.
export async function POST(request: Request) {
  const rl = rateLimit(`public-register:${getClientKey(request)}`, 10, 60_000)
  if (!rl.ok) return Response.json({ error: 'Trop de requêtes, réessayez dans quelques secondes' }, { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } })
  try {
    const body = await request.json()
    const data = publicRegisterSchema.parse(body)

    const church = await db.church.findUnique({
      where: { registrationSlug: data.slug },
      select: { id: true, name: true },
    })
    if (!church) {
      return Response.json({ error: 'Lien d\'inscription invalide' }, { status: 404 })
    }

    const member = await db.member.create({
      data: {
        churchId: church.id,
        firstName: data.firstName,
        lastName: data.lastName,
        type: data.type,
        phone: data.phone,
        email: data.email || null,
        address: data.address,
        department: data.department,
        function: data.function,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        photo: data.photo || null,
        status: 'active',
      },
    })

    // Notifie les admins de la nouvelle inscription (non bloquant)
    notifyChurchUsers({
      churchId: church.id,
      title: 'Nouvelle inscription',
      message: `${data.firstName} ${data.lastName} (${data.type}) vient de s'inscrire via le lien public.`,
      type: 'info',
      push: true,
      roles: ['admin', 'secretary'],
    }).catch((e) => console.warn('notifyChurchUsers public register failed:', e))

    return Response.json({ success: true, member }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Public register POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}