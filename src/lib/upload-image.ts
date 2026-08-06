// Client-side upload helper that posts an image to the server, which stores it in Supabase.
// Returns the public URL of the uploaded file.

export async function uploadImage(
  file: File,
  folder: 'members' | 'logos' | 'documents',
  token: string | null
): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`/api/upload?folder=${folder}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token ?? ''}` },
    body: formData,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Erreur d'envoi de l'image")
  }

  const data = await res.json()
  return data.url
}