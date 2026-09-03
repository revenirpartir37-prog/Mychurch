'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import type { AppView } from '@/lib/constants'
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TabTip {
  title: string
  tip: string
  badge: string
}

const TAB_TIPS: Partial<Record<AppView, TabTip>> = {
  dashboard: {
    title: "Tableau de bord & Vue d'ensemble",
    badge: "Vue d'ensemble",
    tip: "Retrouvez ici le pouls de votre église en temps réel. Suivez vos membres actifs, vos cultes du mois, vos finances et l'état de votre réseau. Cliquez sur n'importe quelle carte pour accéder directement au détail.",
  },
  members: {
    title: "Gestion des Fidèles",
    badge: "Fidèles",
    tip: "Enregistrez vos fidèles avec leurs coordonnées, ministères et statut de baptême. Utilisez le bouton 'Importer Excel' pour intégrer votre fichier paroissial en quelques secondes, et attribuez des cartes en 1 clic.",
  },
  'member-cards': {
    title: "Cartes de Membre Sécurisées",
    badge: "Badges",
    tip: "Chaque carte officielle vaut 10 $ USD (commandable à la demande en pack ou à l'unité). Personnalisez les photos, intégrez le QR Code inviolable et imprimez les badges d'identification de vos chrétiens.",
  },
  finances: {
    title: "Trésorerie & Comptabilité",
    badge: "Comptabilité",
    tip: "Enregistrez précisément les dîmes, offrandes et dons par culte. Saisissez les dépenses avec justificatifs et suivez vos soldes par devise (USD, FC, EUR) pour des bilans financiers clairs et transparents.",
  },
  debts: {
    title: "Dettes & Engagements",
    badge: "Engagements",
    tip: "Suivez les engagements financiers, promesses de dons et dettes de l'église avec échéanciers et alertes automatiques pour garder une gestion saine et rigoureuse.",
  },
  events: {
    title: "Événements & Agenda Paroissial",
    badge: "Agenda",
    tip: "Planifiez vos cultes spéciaux, conférences, séminaires et veillées de prière. Suivez les inscriptions et déclenchez des rappels automatiques pour votre communauté.",
  },
  attendance: {
    title: "Cultes & Présences",
    badge: "Cultes",
    tip: "Enregistrez les présences par appel nominatif, scan rapide de QR Code ou comptage global. Consultez la carte thermique pour identifier les fidèles absents à visiter pastoralement.",
  },
  messages: {
    title: "Communication & Diffusion",
    badge: "Diffusion",
    tip: "Envoyez des annonces importantes, versets du jour et convocations par SMS ou notifications groupées à l'ensemble des fidèles ou par département.",
  },
  reports: {
    title: "Rapports & Statistiques Pastorales",
    badge: "Analyses",
    tip: "Analysez la croissance de l'église, l'évolution démographique et les tendances de dons. Exportez des synthèses graphiques au format PDF prêtes pour vos conseils d'anciens.",
  },
  network: {
    title: "Mon Réseau d'Églises Affiliées",
    badge: "Réseau",
    tip: "Partagez votre lien d'affiliation pour créer de nouvelles paroisses (30 $ / an par église affiliée). Supervisez les statistiques de vos extensions et renouvelez leurs accès en toute simplicité.",
  },
  'users-management': {
    title: "Gestion des Utilisateurs & Rôles",
    badge: "Accès & Rôles",
    tip: "Déléguez la gestion de l'église en toute sécurité en assignant des rôles précis : Pasteur (Admin), Trésorier (Finances), Secrétaire (Membres & Cultes) ou Lecteur (Consultation).",
  },
  archives: {
    title: "Archives & Historique Paroissial",
    badge: "Archives",
    tip: "Consultez et restaurez en toute sécurité les données archivées de l'église (anciens fidèles, transactions clôturées et registres historiques).",
  },
  notifications: {
    title: "Centre de Notifications",
    badge: "Alertes",
    tip: "Retrouvez ici toutes les alertes système, rappels de cultes, notifications financières et confirmations de paiements.",
  },
  settings: {
    title: "Paramètres & Abonnement",
    badge: "Configuration",
    tip: "Configurez les informations officielles de votre église, votre logo et vos devises. Dans l'onglet 'Abonnement', gérez votre formule (50 $/mois ou 100 $/an) ou saisissez votre code secret d'accès à vie.",
  },
  about: {
    title: "À propos de MYCHURCH",
    badge: "Système",
    tip: "MYCHURCH est la solution tout-en-un moderne pour l'édification et la gestion technologique de votre assemblée locale et de votre réseau d'églises.",
  },
}

export function TabTipBanner() {
  const { currentView } = useAppStore()
  const [isOpen, setIsOpen] = useState(true)

  const tipData = TAB_TIPS[currentView]
  if (!tipData) return null

  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-background p-3.5 shadow-sm transition-all duration-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs font-bold text-foreground truncate">
              Astuce : {tipData.title}
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold text-primary">
              {tipData.badge}
            </Badge>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1"
        >
          <span>{isOpen ? 'Masquer' : 'Afficher'}</span>
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {isOpen && (
        <div className="mt-2 text-xs text-muted-foreground leading-relaxed pl-9 pr-2 border-t border-primary/10 pt-2 animate-in fade-in">
          {tipData.tip}
        </div>
      )}
    </div>
  )
}
