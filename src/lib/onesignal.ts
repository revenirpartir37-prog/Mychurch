// Envoi de notifications push OneSignal côté serveur (REST API).
// Requiert dans l'environnement :
//   NEXT_PUBLIC_ONESIGNAL_APP_ID  (l'appId « public »)
//   ONESIGNAL_REST_API_KEY        (clé REST API, côté serveur uniquement)
const ONESIGNAL_URL = 'https://api.onesignal.com/api/v1/notifications'

export interface PushContent {
  title?: string
  message?: string
  // cibles
  userIds?: string[]      // ids applicatifs (mappés à OneSignal external user id) — vide = tous les abonnés
  segments?: string[]     // ex. ['Subscribed Users'] / ['Active Users']
}

// Envoie une push via l'API OneSignal. Ne jamais lancer : si la clé manque, on skip.
export async function sendPushNotification(content: PushContent): Promise<boolean> {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey) return false

  const body: Record<string, unknown> = {
    app_id: appId,
    headings: { en: content.title || 'MYCHURCH' },
    contents: {
      en: content.message || 'Nouvelle notification',
    },
  }

  if (content.userIds && content.userIds.length > 0) {
    body.include_external_user_ids = content.userIds
  } else if (content.segments && content.segments.length > 0) {
    body.included_segments = content.segments
  } else {
    body.included_segments = ['Total Subscriptions']
  }

  try {
    const res = await fetch(ONESIGNAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error(`OneSignal push failed (${res.status}):`, await res.text())
      return false
    }
    return true
  } catch (e) {
    console.error('OneSignal push error:', e)
    return false
  }
}