'use client'

import { Separator } from '@/components/ui/separator'
import { CREATOR } from '@/lib/constants'
import { useAppStore } from '@/store/app-store'

export function ChurchFooter() {
  const { setCurrentView } = useAppStore()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-border bg-card/50">
      <div className="px-4 py-4 sm:px-6">
        <p className="text-center text-sm font-medium text-foreground mb-2">
          {CREATOR}
        </p>
        <Separator className="my-2" />
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <button
            onClick={() => setCurrentView('about')}
            className="hover:text-foreground transition-colors"
          >
            À propos
          </button>
          <span>·</span>
          <span>© {currentYear} MYCHURCH</span>
          <span>·</span>
          <button
            onClick={() => setCurrentView('settings')}
            className="hover:text-foreground transition-colors"
          >
            Contact
          </button>
        </div>
      </div>
    </footer>
  )
}