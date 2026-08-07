import { db } from '@/lib/db'
import { z } from 'zod'

const publicRegisterSchema = z.object({
  slug: z.string().min(1),
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  type: z.enum(['member', 'personnel']).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email invalide').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  function: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
})

// POST /api/public/register
// Public self-registration for members via the church's unique link.
export async function POST(request: Request) {
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
        type: data.type || 'member',
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        department: data.department || null,
        function: data.function || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        photo: data.photo || null,
        status: 'active',
      },
    })

    return Response.json({ success: true, member }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Public register POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}