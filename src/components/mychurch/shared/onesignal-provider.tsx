'use client'

import { useEffect } from 'react'

declare global {
  // Extend Window to include the OneSignal global added by the SDK script.
  interface Window {
    OneSignal?: {
      init: (config: Record<string, unknown>) => Promise<void>
    }
  }
}

export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) return

    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    script.async = true

    script.onload = () => {
      if (window.OneSignal) {
        window.OneSignal.init({
          appId,
          notifyButton: {
            enable: true,
          },
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/' },
        })
      }
    }

    document.head.appendChild(script)

    return () => {
      // Clean up the injected script on unmount.
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  return <>{children}</>
}