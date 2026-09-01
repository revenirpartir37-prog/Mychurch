'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Global error boundary:', error)
  }, [error])

  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-lg font-semibold">Erreur critique</h2>
        <p className="mt-2 text-sm text-muted-foreground">Veuillez rafraîchir la page.</p>
        <Button onClick={reset} className="mt-6">Rafraîchir</Button>
      </body>
    </html>
  )
}
