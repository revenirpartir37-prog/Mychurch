'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Copy } from 'lucide-react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[MYCHURCH ERROR]', error?.message, error?.stack)
  }, [error])

  const errorInfo = `${error?.message || 'Unknown'}\n${error?.digest || ''}\n${error?.stack || ''}`

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">L&apos;application a rencontré un problème inattendu.</p>
      <pre className="mt-4 p-3 bg-muted rounded-lg text-xs text-left max-w-lg w-full overflow-auto max-h-48 whitespace-pre-wrap break-words font-mono">{errorInfo}</pre>
      <div className="flex gap-2 mt-4">
        <Button onClick={() => { navigator.clipboard?.writeText(errorInfo) }} variant="outline" className="gap-2">
          <Copy className="h-3.5 w-3.5" /> Copier l'erreur
        </Button>
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </div>
  )
}
