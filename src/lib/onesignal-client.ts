// Client OneSignal unique et fiable.
// - Charge le SDK v16 (script async) une seule fois.
// - Toutes les méthodes passent par la file `OneSignalDeferred` (recommandée par la doc)
//   et attendent la fin de `init()` avant d'agir.
// - `requestPermission()` est à appeler depuis un geste utilisateur (clic).

type OneSignalInstance = {
  init?: (config: Record<string, unknown>) => Promise<void>
  login?: (externalId: string) => Promise<void>
  logout?: () => Promise<void>
  Notifications?: {
    requestPermission: () => Promise<unknown>
    isPushSupported: () => boolean
    permission?: boolean
  }
  User?: {
    onesignalId?: string | null
    externalId?: string | null
    PushSubscription?: {
      id?: string | null
      token?: string | null
      optedIn?: boolean
      optIn?: () => Promise<void>
      optOut?: () => Promise<void>
    }
  }
}

let initPromise: Promise<OneSignalInstance | null> | null = null

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

function loadScript(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).OneSignal) return resolve()
    const existing = document.getElementById('onesignal-sdk')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => {
        console.error(JSON.stringify({ scope: 'onesignal:client', msg: 'SDK_LOAD_ERROR_EXISTING' }))
        resolve()
      })
      return
    }
    const script = document.createElement('script')
    script.id = 'onesignal-sdk'
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      console.error(JSON.stringify({ scope: 'onesignal:client', msg: 'SDK_LOAD_ERROR' }))
      resolve()
    }
    document.body.appendChild(script)
  })
}

// Retourne l'instance OneSignal prête (init faite) ou null si impossible.
export function getOneSignal(): Promise<OneSignalInstance | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (initPromise) return initPromise

  initPromise = (async () => {
    await loadScript()
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) {
      const msg = 'NEXT_PUBLIC_ONESIGNAL_APP_ID manquant — push désactivé'
      console.warn(JSON.stringify({ scope: 'onesignal:client', msg }))
      if (process.env.NODE_ENV === 'development') console.warn(msg)
      return null
    }

    const w = window as any
    w.OneSignalDeferred = w.OneSignalDeferred || []

    // On attend que le SDK initialise. La file `OneSignalDeferred` est vidée par le SDK.
    let retry = 0
    return new Promise<OneSignalInstance | null>((resolve) => {
      const check = () => {
        const os = w.OneSignal
        if (os) {
          try {
            os.init({
              appId,
              notifyButton: { enable: false },
              welcomeNotification: {
                title: 'MYCHURCH',
                message: 'Bienvenue sur MYCHURCH !',
              },
            }).then(() => resolve(os)).catch(() => resolve(os))
          } catch {
            resolve(os)
          }
          return
        }
        if (++retry > 50) {
          resolve(null)
          return
        }
        setTimeout(check, 200)
      }
      check()
    })
  })()

  return initPromise
}

// Demande la permission push notifications (à appeler depuis un geste utilisateur).
export async function requestPushPermission(): Promise<void> {
  if (typeof window === 'undefined') return
  if (typeof Notification === 'undefined') {
    throw new Error('Les notifications ne sont pas supportées sur cet appareil')
  }

  // 1. Tenter via OneSignal ou l'API native
  const os = await getOneSignal()
  if (os?.Notifications?.requestPermission) {
    try {
      await os.Notifications.requestPermission()
    } catch {
      await Notification.requestPermission()
    }
  } else {
    await Notification.requestPermission()
  }

  // 2. Vérifier la réponse de l'utilisateur
  if (Notification.permission === 'denied') {
    throw new Error('Permission de notification refusée dans le navigateur')
  }

  if (Notification.permission !== 'granted') {
    throw new Error('Permission de notification non accordée')
  }

  // 3. Tenter l'opt-in OneSignal en tâche de fond sans bloquer l'interface
  if (os?.User?.PushSubscription?.optIn) {
    try {
      await os.User.PushSubscription.optIn()
    } catch {
      // Ignorer si la négociation du token push prend un peu de temps
    }
  }
}

// Associe l'utilisateur (id Supabase) à l'abonnement push.
export async function setPushUser(userId: string): Promise<void> {
  const os = await getOneSignal()
  if (!os) {
    console.warn(JSON.stringify({ scope: 'onesignal:client', msg: 'SET_PUSH_USER_NO_OS', userId }))
    return
  }
  const subscribed = await isSubscribed()
  if (!subscribed) {
    console.warn(JSON.stringify({ scope: 'onesignal:client', msg: 'SET_PUSH_USER_NOT_SUBSCRIBED', userId }))
  }
  try {
    await os?.login?.(userId)
  } catch (error) {
    console.error(JSON.stringify({ scope: 'onesignal:client', msg: 'LOGIN_ERROR', userId, error: error instanceof Error ? error.message : String(error) }))
  }
}

// Dissocie l'utilisateur à la déconnexion.
export async function clearPushUser(): Promise<void> {
  const os = await getOneSignal()
  try {
    await os?.logout?.()
  } catch (error) {
    console.error('OneSignal logout error:', error)
  }
}

// Indique si ce navigateur est déjà abonné au push.
export async function isSubscribed(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    return true
  }
  const os = await getOneSignal()
  if (!os) return false
  return !!os.User?.PushSubscription?.optedIn
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (typeof window === 'undefined') return 'unsupported'
  if (typeof Notification === 'undefined') return 'unsupported'

  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return 'default'
}