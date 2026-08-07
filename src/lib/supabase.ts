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

// ============================================================
// Supabase Auth — source d'identité (email/mot de passe).
// L'app émet SON JWT (contrat {userId, churchId, role}) après
// vérification auprès de Supabase Auth, pour ne pas casser les routes.
// ============================================================

// Vérifie un couple email/mot de passe via Supabase Auth.
// Retourne l'id Supabase de l'utilisateur si valide, sinon throw.
export async function verifySupabasePassword(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    throw new Error('InvalidCredentials')
  }
  return data.user.id
}

// Crée un utilisateur Supabase Auth (email_confirm true → pas de mail requis).
// Retourne l'id Supabase du user.
export async function createSupabaseUser(email: string, password: string): Promise<string> {
  const service = createServiceClient()
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(error?.message || 'Registration failed')
  }
  return data.user.id
}

// Met à jour le mot de passe Supabase d'un utilisateur (mot été oublié / reset).
export async function updateSupabasePassword(email: string, newPassword: string): Promise<void> {
  const service = createServiceClient()
  const { data: userData, error: listError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (!listError && userData?.users) {
    const target = userData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (target) {
      await service.auth.admin.updateUserById(target.id, { password: newPassword })
      return
    }
  }
  // User Supabase introuvable → rien à mettre à jour.
}

// ============================================================
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