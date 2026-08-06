import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

async function getAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  return await verifyAccessToken(token)
}

// Column mapping: French CSV headers → Member model fields
const COLUMN_MAP: Record<string, string> = {
  prenom: 'firstName',
  nom: 'lastName',
  email: 'email',
  telephone: 'phone',
  adresse: 'address',
  departement: 'department',
  fonction: 'function',
  statut: 'status',
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  fields.push(current.trim())
  return fields
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return Response.json({ error: 'Fichier CSV requis' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)

    if (lines.length < 2) {
      return Response.json({ error: 'Le fichier CSV doit contenir au moins un en-tête et une ligne de données' }, { status: 400 })
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
    const mappedIndices: { field: string; index: number }[] = []

    for (let i = 0; i < headers.length; i++) {
      const field = COLUMN_MAP[headers[i]]
      if (field) {
        mappedIndices.push({ field, index: i })
      }
    }

    // Ensure at least firstName and lastName are present
    const hasFirstName = mappedIndices.some((m) => m.field === 'firstName')
    const hasLastName = mappedIndices.some((m) => m.field === 'lastName')
    if (!hasFirstName || !hasLastName) {
      return Response.json(
        {
          error: 'Colonnes manquantes',
          details: 'Le fichier doit contenir au moins les colonnes "prenom" et "nom"',
        },
        { status: 400 },
      )
    }

    let imported = 0
    let skipped = 0
    const total = lines.length - 1 // exclude header

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const row: Record<string, string> = {}
      for (const { field, index } of mappedIndices) {
        row[field] = values[index] || ''
      }

      const firstName = (row.firstName || '').trim()
      const lastName = (row.lastName || '').trim()
      if (!firstName || !lastName) {
        skipped++
        continue
      }

      let email = (row.email || '').trim() || null
      let status: 'active' | 'inactive' = 'active'
      if (row.status) {
        const s = row.status.toLowerCase().trim()
        if (s === 'inactif' || s === 'inactive') {
          status = 'inactive'
        }
      }

      // Upsert: skip if email + churchId already exists
      if (email) {
        const exists = await db.member.findFirst({
          where: { email, churchId: auth.churchId },
        })
        if (exists) {
          skipped++
          continue
        }
      }

      await db.member.create({
        data: {
          churchId: auth.churchId,
          firstName,
          lastName,
          phone: (row.phone || '').trim() || null,
          email,
          address: (row.address || '').trim() || null,
          department: (row.department || '').trim() || null,
          function: (row.function || '').trim() || null,
          status,
          joinDate: new Date(),
        },
      })
      imported++
    }

    return Response.json({ imported, skipped, total })
  } catch (error) {
    console.error('CSV import error:', error)
    return Response.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}