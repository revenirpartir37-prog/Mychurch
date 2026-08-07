import { verifyAccessToken } from '@/lib/auth'
import { NextRequest } from 'next/server'
import { createServiceClient, SUPABASE_BUCKET } from '@/lib/supabase'
import { randomUUID } from 'crypto'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || !payload.churchId || !payload.userId) return null
  return payload
}

// POST /api/upload?folder=members|logos|documents
// Body: FormData with a single "file" field
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder') || 'members'

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return Response.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: 'Format d\'image non supporté' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'Image trop lourde (max 5 Mo)' }, { status: 400 })
    }

    const ext = file.type.split('/')[1] === 'svg+xml' ? 'svg' : file.type.split('/')[1] || 'jpg'
    const path = `${folder}/${auth.churchId}/${randomUUID()}.${ext}`

    const supabase = createServiceClient()
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return Response.json({ error: 'Erreur d\'enregistrement de l\'image' }, { status: 500 })
    }

    const { data: publicData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(path)

    return Response.json({ url: publicData?.publicUrl || null, path }, { status: 201 })
  } catch (error) {
    console.error('Upload POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}