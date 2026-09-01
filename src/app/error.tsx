'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('App error boundary:', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">L&apos;application a rencontré un problème inattendu. Veuillez réessayer.</p>
      <Button onClick={reset} className="mt-6">Réessayer</Button>
    </div>
  )
}
