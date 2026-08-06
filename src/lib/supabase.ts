import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Client-side Supabase (anon). Used for public reads and storage uploads.
export const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: false },
  }
)

export const SUPABASE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'Mychurch-bucket'

// Server-side Supabase with the service role key (admin privileges only on the server).
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase server configuration is missing')
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

// Extracts the storage object key (or returns the URL) for a Supabase public asset.
export function getPublicUrl(path: string | null): string | null {
  if (!path) return null
  // Already a full URL (data URI or http(s))
  if (/^(data:|https?:|blob:)/.test(path)) return path
  const { data } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(path)
  return data?.publicUrl || null
}