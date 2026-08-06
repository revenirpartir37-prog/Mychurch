'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Smartphone, Apple, Monitor } from 'lucide-react'

type OSType = 'android' | 'ios' | 'desktop' | 'unknown'

function getOS(): OSType {
  if (typeof window === 'undefined') return 'unknown'
  const ua = window.navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  // Newer iPads report as Macintosh — detect via touch support
  if (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua)) return 'ios'
  return 'desktop'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

interface InstallPromptEvent {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallButton() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [iosDialogOpen, setIosDialogOpen] = useState(false)
  const [androidDialogOpen, setAndroidDialogOpen] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [ready, setReady] = useState(false)
  const eventRef = useRef<InstallPromptEvent | null>(null)

  useEffect(() => {
    // Already installed?
    if (isStandalone()) {
      setStandalone(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      const evt = e as unknown as InstallPromptEvent
      eventRef.current = evt
      setInstallEvent(evt)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // If the event already fired before this component mounted
    if (eventRef.current) {
      setInstallEvent(eventRef.current)
    }

    setReady(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const os = getOS()
  if (!ready || standalone || os === 'unknown') return null

  const handleAndroidInstall = async () => {
    if (installEvent) {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      if (choice.outcome === 'accepted') {
        setInstallEvent(null)
        setAndroidDialogOpen(false)
      }
    } else {
      // Native prompt not yet available — show manual instructions
      setAndroidDialogOpen(true)
    }
  }

  const handleIOSInstall = () => {
    setIosDialogOpen(true)
  }

  const handleDesktopInstall = async () => {
    if (installEvent) {
      await installEvent.prompt()
      setInstallEvent(null)
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {os === 'android' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAndroidInstall}
            className="gap-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          >
            <Smartphone className="h-4 w-4" />
            Installer sur Android
          </Button>
        )}

        {os === 'ios' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleIOSInstall}
            className="gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
          >
            <Apple className="h-4 w-4" />
            Installer sur iPhone
          </Button>
        )}

        {os === 'desktop' && installEvent && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDesktopInstall}
            className="gap-2"
          >
            <Monitor className="h-4 w-4" />
            Installer l&apos;application
          </Button>
        )}
      </div>

      {/* Android instructions dialog */}
      <Dialog open={androidDialogOpen} onOpenChange={setAndroidDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              Installer MYCHURCH sur Android
            </DialogTitle>
            <DialogDescription>
              Ajoutez MYCHURCH à votre écran d&apos;accueil pour un accès rapide
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3 items-start">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold">
                1
              </div>
              <div>
                <p className="text-sm font-medium">Appuyez sur les trois points</p>
                <p className="text-xs text-muted-foreground">
                  Touchez le bouton ⋮ en haut à droite de Chrome
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold">
                2
              </div>
              <div>
                <p className="text-sm font-medium">Sélectionnez &quot;Installer l&apos;application&quot;</p>
                <p className="text-xs text-muted-foreground">
                  OU &quot;Ajouter à l&apos;écran d&apos;accueil&quot;
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold">
                3
              </div>
              <div>
                <p className="text-sm font-medium">Confirmez l&apos;installation</p>
                <p className="text-xs text-muted-foreground">
                  MYCHURCH apparaîtra sur votre écran d&apos;accueil
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* iOS instructions dialog */}
      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Apple className="h-5 w-5 text-blue-600" />
              Installer MYCHURCH sur iPhone
            </DialogTitle>
            <DialogDescription>
              Ajoutez MYCHURCH à votre écran d&apos;accueil depuis Safari
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3 items-start">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                1
              </div>
              <div>
                <p className="text-sm font-medium">Ouvrez cette page dans Safari</p>
                <p className="text-xs text-muted-foreground">
                  L&apos;application ne peut être installée que depuis Safari
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                2
              </div>
              <div>
                <p className="text-sm font-medium">Appuyez sur l&apos;icône Partager</p>
                <p className="text-xs text-muted-foreground">
                  Touchez le bouton avec la flèche qui sort d&apos;un carré en bas de Safari
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                3
              </div>
              <div>
                <p className="text-sm font-medium">Faites défiler vers le bas</p>
                <p className="text-xs text-muted-foreground">
                  Cherchez l&apos;option &quot;Sur l&apos;écran d&apos;accueil&quot;
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                4
              </div>
              <div>
                <p className="text-sm font-medium">Appuyez sur &quot;Ajouter&quot;</p>
                <p className="text-xs text-muted-foreground">
                  L&apos;application MYCHURCH apparaîtra sur votre écran d&apos;accueil
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
