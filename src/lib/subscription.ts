import { db } from '@/lib/db'
import { getPayment } from '@/lib/geniuspay'
import { addDays, addMonths, addYears } from 'date-fns'

export interface ChurchSubscriptionResult {
  subscription: any | null
  isExpired: boolean
  canAccess: boolean
  isPending: boolean
  isLifetime: boolean
}

/**
 * Calcule la date de fin d'un abonnement de façon robuste sans décalage de fin de mois.
 * Si une date de fin valide et future existe déjà, elle est prolongée (les jours restants sont préservés).
 */
export function calculateSubscriptionEndDate(plan: string, existingEndDate?: Date | string | null): Date {
  const now = new Date()
  let baseDate = now

  if (existingEndDate) {
    const parsed = new Date(existingEndDate)
    if (!isNaN(parsed.getTime()) && parsed.getTime() > now.getTime()) {
      baseDate = parsed
    }
  }

  switch (plan) {
    case 'lifetime':
      return new Date('2099-12-31T23:59:59.999Z')
    case 'trial':
      return addDays(baseDate, 7)
    case 'monthly':
      return addMonths(baseDate, 1)
    case 'annual':
    case 'annual_branch':
      return addYears(baseDate, 1)
    default:
      return addMonths(baseDate, 1)
  }
}

/**
 * Source unique de vérité pour résoudre l'état et l'accès d'abonnement d'une église.
 */
export async function getChurchSubscriptionStatus(
  churchId: string,
  options: { autoCreateTrial?: boolean } = { autoCreateTrial: true }
): Promise<ChurchSubscriptionResult> {
  const now = new Date()

  // 1. Vérifier si un paiement récent en attente a été complété sur GeniusPay
  const pendingSub = await db.subscription.findFirst({
    where: {
      churchId,
      paymentStatus: 'pending',
      paymentRef: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (pendingSub?.paymentRef) {
    try {
      const paymentResponse = await getPayment(pendingSub.paymentRef)
      if (paymentResponse.success && paymentResponse.data?.status === 'completed') {
        await db.subscription.update({
          where: { id: pendingSub.id },
          data: { paymentStatus: 'completed', status: 'active' },
        })
      }
    } catch {
      // Si GeniusPay est temporairement indisponible, on continue
    }
  }

  // 2. Priorité 1 : Abonnement permanent à vie (VIP Admin)
  const lifetimeSub = await db.subscription.findFirst({
    where: {
      churchId,
      plan: 'lifetime',
      paymentStatus: 'completed',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (lifetimeSub) {
    return {
      subscription: lifetimeSub,
      isExpired: false,
      canAccess: true,
      isPending: false,
      isLifetime: true,
    }
  }

  // 3. Priorité 2 : Abonnement actif payé ou essai en cours avec date de fin future
  const activeSub = await db.subscription.findFirst({
    where: {
      churchId,
      status: 'active',
      paymentStatus: 'completed',
      endDate: { gte: now },
    },
    orderBy: { endDate: 'desc' },
  })

  if (activeSub) {
    return {
      subscription: activeSub,
      isExpired: false,
      canAccess: true,
      isPending: false,
      isLifetime: false,
    }
  }

  // 4. Priorité 3 : Abonnement en attente de confirmation avec date future
  const futurePendingSub = await db.subscription.findFirst({
    where: {
      churchId,
      paymentStatus: 'pending',
      endDate: { gte: now },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (futurePendingSub) {
    return {
      subscription: futurePendingSub,
      isExpired: false,
      canAccess: true,
      isPending: true,
      isLifetime: false,
    }
  }

  // 5. Priorité 4 : Première visite sans aucun abonnement dans l'historique
  const anySub = await db.subscription.findFirst({
    where: { churchId },
    orderBy: { createdAt: 'desc' },
  })

  if (!anySub && options.autoCreateTrial) {
    const trialEndDate = calculateSubscriptionEndDate('trial', now)
    const trialSub = await db.subscription.create({
      data: {
        churchId,
        plan: 'trial',
        status: 'active',
        startDate: now,
        endDate: trialEndDate,
        amount: 0,
        currency: 'USD',
        paymentStatus: 'completed',
        paymentRef: `TRIAL-AUTO-${Date.now()}`,
      },
    })

    return {
      subscription: trialSub,
      isExpired: false,
      canAccess: true,
      isPending: false,
      isLifetime: false,
    }
  }

  // 6. Priorité 5 : Tous les abonnements existants sont expirés (endDate < now)
  if (anySub) {
    if (anySub.status === 'active') {
      await db.subscription.update({
        where: { id: anySub.id },
        data: { status: 'expired' },
      }).catch(() => {})
    }

    return {
      subscription: anySub,
      isExpired: true,
      canAccess: false,
      isPending: false,
      isLifetime: false,
    }
  }

  return {
    subscription: null,
    isExpired: true,
    canAccess: false,
    isPending: false,
    isLifetime: false,
  }
}
