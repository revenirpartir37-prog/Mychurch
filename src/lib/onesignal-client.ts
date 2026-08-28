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
  return new Promise((resolve, reject) => {
    if ((window as any).OneSignal) return resolve()
    const existing = document.getElementById('onesignal-sdk')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => {
        console.error(JSON.stringify({ scope: 'onesignal:client', msg: 'SDK_LOAD_ERROR_EXISTING' }))
        reject(new Error('OneSignal SDK load error'))
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
      reject(new Error('OneSignal SDK load error'))
    }
    document.body.appendChild(script)
  })
}

// Retourne l'instance OneSignal prête (init faite) ou null si impossible.
export function getOneSignal(): Promise<OneSignalInstance | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      await loadScript()
    } catch (e) {
      console.error(JSON.stringify({ scope: 'onesignal:client', msg: 'SDK_LOAD_FAILED', error: e instanceof Error ? e.message : String(e) }))
      return null
    }
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
              notifyButton: { enable: true },
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
  const os = await getOneSignal()
  if (!os) {
    throw new Error('OneSignal non initialisé')
  }

  const isSupported = os.Notifications?.isPushSupported?.() ?? false
  if (!isSupported) {
    throw new Error('Les notifications push ne sont pas supportées sur cet appareil')
  }

  await os.Notifications?.requestPermission()
  const subscribed = await isSubscribed()
  if (!subscribed) {
    throw new Error('Permission refusée ou abonnement inactif')
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
  const os = await getOneSignal()
  if (!os) return false
  return !!os.User?.PushSubscription?.optedIn
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (typeof window === 'undefined') return 'unsupported'
  if (typeof Notification === 'undefined') return 'unsupported'

  const os = await getOneSignal()
  const supported = os?.Notifications?.isPushSupported?.() ?? false
  if (!supported) return 'unsupported'

  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return 'default'
}