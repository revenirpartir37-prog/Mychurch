import { db } from '@/lib/db'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { createPayment } from '@/lib/geniuspay'

const registerAffiliateSchema = z.object({
  code: z.string().min(1, 'Code d’affiliation requis'),
  churchName: z.string().min(2, 'Le nom de la paroisse est requis'),
  address: z.string().min(2, 'L’adresse est requise'),
  city: z.string().min(2, 'La ville est requise'),
  province: z.string().min(2, 'La province/région est requise'),
  country: z.string().min(2, 'Le pays est requis'),
  currency: z.string().default('USD'),
  churchEmail: z.string().email('Email de l’église invalide'),
  churchPhone: z.string().optional(),
  adminFirstName: z.string().min(2, 'Prénom de l’administrateur requis'),
  adminLastName: z.string().min(2, 'Nom de l’administrateur requis'),
  adminEmail: z.string().email('Email de l’administrateur requis'),
  adminPassword: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères'),
})

// GET: Vérifier le code d'affiliation et obtenir les infos de l'église mère
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return Response.json({ error: 'Code manquant' }, { status: 400 })
    }

    const parentChurch = await db.church.findUnique({
      where: { affiliationCode: code },
      select: {
        id: true,
        name: true,
        logo: true,
        city: true,
        country: true,
      },
    })

    if (!parentChurch) {
      return Response.json({ error: 'Code d’affiliation invalide ou expiré' }, { status: 404 })
    }

    return Response.json({ parentChurch })
  } catch (error) {
    console.error('Affiliate check error:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST: Inscription de la nouvelle église affiliée
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = registerAffiliateSchema.parse(body)

    const parentChurch = await db.church.findUnique({
      where: { affiliationCode: data.code },
      include: {
        subscriptions: {
          where: { status: 'active', paymentStatus: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!parentChurch) {
      return Response.json({ error: 'Code d’affiliation invalide' }, { status: 400 })
    }

    const parentSub = parentChurch.subscriptions[0]
    const isParentActive = parentSub && parentSub.plan !== 'trial' && new Date(parentSub.endDate) > new Date()
    if (!isParentActive) {
      return Response.json({
        error: 'Le Siège de votre réseau doit avoir un abonnement actif (50 $ / mois ou 100 $ / an) pour enregistrer de nouvelles églises affiliées (non disponible en essai gratuit).',
      }, { status: 403 })
    }

    // Vérifier si l'email de l'église existe déjà
    const existingChurchEmail = await db.church.findUnique({
      where: { email: data.churchEmail },
    })
    if (existingChurchEmail) {
      return Response.json({ error: 'Cet email d’église est déjà utilisé' }, { status: 400 })
    }

    // 1. Créer la paroisse affiliée rattachée au Siège
    const newBranch = await db.church.create({
      data: {
        name: data.churchName,
        address: data.address,
        city: data.city,
        province: data.province,
        country: data.country,
        currency: data.currency,
        email: data.churchEmail,
        phone: data.churchPhone || null,
        parentId: parentChurch.id,
        isHeadquarters: false,
        registrationSlug: 'aff-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      },
    })

    // 2. Créer l'administrateur local de l'église affiliée
    const passwordHash = await bcrypt.hash(data.adminPassword, 10)
    const adminUser = await db.user.create({
      data: {
        churchId: newBranch.id,
        email: data.adminEmail,
        firstName: data.adminFirstName,
        lastName: data.adminLastName,
        passwordHash,
        role: 'admin',
        isActive: true,
        verified: true,
      },
    })

    // 3. Initier le paiement obligatoire de 30 $ USD sur GeniusPay
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
    const paymentResponse = await createPayment({
      amount: 30,
      currency: 'USD',
      description: `30.00 $ USD - Affiliation Réseau Paroisse MYCHURCH (${data.churchName})`,
      customer: {
        name: `${data.adminFirstName} ${data.adminLastName}`,
        email: data.adminEmail,
      },
      success_url: `${origin}/affiliate/success?churchId=${newBranch.id}&status=success`,
      error_url: `${origin}/affiliate/${data.code}?error=payment_failed`,
      callback_url: `${origin}/api/payments/webhook`,
      metadata: {
        churchId: newBranch.id,
        userId: adminUser.id,
        paymentType: 'subscription',
        plan: 'annual_branch',
        amount: 30,
        currency: 'USD',
      },
    })

    if (!paymentResponse.success || !paymentResponse.data) {
      console.error('Affiliate registration payment error:', paymentResponse.error)
      return Response.json(
        { error: paymentResponse.error?.message || 'Erreur lors de l’initialisation du paiement de 30 $' },
        { status: 400 }
      )
    }

    const paymentData = paymentResponse.data
    const paymentUrl = paymentData.checkout_url || paymentData.payment_url || ''
    const reference = paymentData.reference

    // 4. Créer l'abonnement initial en attente de paiement (status: pending)
    const startDate = new Date()
    const endDate = new Date()
    endDate.setFullYear(endDate.getFullYear() + 1)

    await db.subscription.create({
      data: {
        churchId: newBranch.id,
        plan: 'annual_branch',
        status: 'pending',
        startDate,
        endDate,
        amount: 30,
        currency: 'USD',
        paymentStatus: 'pending',
        paymentRef: reference,
      },
    })

    return Response.json({
      success: true,
      message: 'Compte paroisse pré-créé. Redirection vers le paiement de 30 $ USD...',
      paymentUrl,
      reference,
      church: {
        id: newBranch.id,
        name: newBranch.name,
      },
      user: {
        email: adminUser.email,
        firstName: adminUser.firstName,
      },
    })
  } catch (error: any) {
    console.error('Affiliate register error:', error)
    const message = error.errors?.[0]?.message || error.message || 'Erreur lors de l’inscription'
    return Response.json({ error: message }, { status: 400 })
  }
}
