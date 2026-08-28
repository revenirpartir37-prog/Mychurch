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

export type PushResult = { ok: true } | { ok: false; reason: string; status?: number }

function logPush(level: 'warn' | 'error', msg: string, meta?: Record<string, unknown>) {
  const payload = JSON.stringify({ scope: 'onesignal:push', msg, ...meta, ts: new Date().toISOString() })
  if (level === 'warn') console.warn(payload)
  else console.error(payload)
}

// Envoie une push via l'API OneSignal. Ne jamais throw côté appelant sauf config manquante en dev.
// Retourne un résultat explicite pour que l'appelant puisse logger/monitorer.
export async function sendPushNotification(content: PushContent): Promise<PushResult> {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey) {
    logPush('warn', 'ONESIGNAL_CONFIG_MISSING_SKIP', { hasAppId: !!appId, hasApiKey: !!apiKey })
    return { ok: false, reason: 'ONESIGNAL_CONFIG_MISSING' }
  }

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

  // Retry exponentiel 3 tentatives (500ms, 1s, 2s) — évite échec silencieux sous charge
  let lastErr: PushResult = { ok: false, reason: 'UNKNOWN' }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(ONESIGNAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${apiKey}`,
        },
        body: JSON.stringify(body),
      })
      if (res.ok) return { ok: true }
      const text = await res.text()
      lastErr = { ok: false, reason: `HTTP_${res.status}`, status: res.status }
      logPush('error', 'ONESIGNAL_PUSH_FAILED', { attempt: attempt + 1, status: res.status, body: text.slice(0, 500), userIds: content.userIds?.length ?? 0 })
      if (res.status >= 400 && res.status < 500) break // 4xx non retryable
    } catch (e) {
      lastErr = { ok: false, reason: 'EXCEPTION' }
      logPush('error', 'ONESIGNAL_PUSH_EXCEPTION', { attempt: attempt + 1, error: e instanceof Error ? e.message : String(e) })
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)))
  }
  return lastErr
}