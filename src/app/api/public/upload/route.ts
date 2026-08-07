import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { createServiceClient, SUPABASE_BUCKET } from '@/lib/supabase'
import { randomUUID } from 'crypto'

// POST /api/public/upload?slug=xxx&folder=members
// Public upload used by the registration page. The slug must be a valid church registration link.
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug') || ''
    const folder = searchParams.get('folder') || 'members'

    if (!slug) {
      return Response.json({ error: 'Lien d\'inscription manquant' }, { status: 400 })
    }

    const church = await db.church.findUnique({
      where: { registrationSlug: slug },
      select: { id: true },
    })
    if (!church) {
      return Response.json({ error: 'Lien d\'inscription invalide' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return Response.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: 'Format d\'image non supporté' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'Image trop lourde (max 5 Mo)' }, { status: 400 })
    }

    const ext = file.type.split('/')[1] || 'jpg'
    const path = `${folder}/${church.id}/${randomUUID()}.${ext}`

    const supabase = createServiceClient()
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('Supabase public upload error:', uploadError)
      return Response.json({ error: 'Erreur d\'enregistrement de l\'image' }, { status: 500 })
    }

    const { data: publicData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(path)

    return Response.json({ url: publicData?.publicUrl || null, path }, { status: 201 })
  } catch (error) {
    console.error('Public upload POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}