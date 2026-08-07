import { db } from '@/lib/db'

// GET /api/public/church?slug=xxx
// Publicly returns basic church info for the registration page.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug') || ''
    if (!slug) {
      return Response.json({ error: 'Slug requis' }, { status: 400 })
    }

    const church = await db.church.findUnique({
      where: { registrationSlug: slug },
      select: { id: true, name: true, logo: true, address: true, city: true },
    })
    if (!church) {
      return Response.json({ error: 'Église introuvable' }, { status: 404 })
    }

    return Response.json({ church })
  } catch (error) {
    console.error('Public church GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}