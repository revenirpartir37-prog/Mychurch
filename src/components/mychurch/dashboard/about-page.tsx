'use client'

import { CREATOR, APP_VERSION } from '@/lib/constants'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CheckCircle } from 'lucide-react'

const FEATURES = [
  'Gestion complète des membres',
  'Réseau multi-églises et paroisses affiliées',
  'Génération de cartes de membre avec QR Code',
  'Suivi financier multi-devise',
  'Gestion des événements et présences',
  'Système de messagerie interne',
  'Rapports et statistiques détaillées',
  'Notifications en temps réel',
  'Application mobile (PWA)',
]

export function AboutPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          {/* Logo */}
          <div className="mx-auto">
            <img
              src="/logo-mychurch.png"
              alt="MYCHURCH"
              className="h-24 w-24 object-contain"
            />
          </div>

          {/* App name */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MYCHURCH</h1>
            <p className="text-sm font-semibold text-primary mt-1">Version {APP_VERSION}</p>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            MYCHURCH est une plateforme de gestion d&apos;église complète et moderne.
            Conçue pour simplifier l&apos;administration ecclésiastique, elle offre
            tous les outils nécessaires pour gérer efficacement votre communauté.
          </p>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-6 pt-6">
          {/* Features */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Fonctionnalités
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Creator */}
          <div className="text-center py-4">
            <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
              {CREATOR}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
