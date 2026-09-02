'use client'

import { usePWAUpdate } from '@/hooks/use-pwa-update'
import { Button } from '@/components/ui/button'
import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function PWAUpdateBanner() {
  const { isUpdateAvailable, update, dismiss } = usePWAUpdate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isUpdateAvailable) {
      setVisible(true)
    }
  }, [isUpdateAvailable])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-border bg-background p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <RefreshCw className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Mise à jour disponible</p>
          <p className="text-xs text-muted-foreground">
            Une nouvelle version est prête. Rechargez pour mettre à jour.
          </p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" onClick={update} className="h-8 text-xs">
            Mettre à jour
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { dismiss(); setVisible(false) }} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
