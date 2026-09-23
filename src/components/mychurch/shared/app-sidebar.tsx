'use client'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  Banknote,
  Euro,
  Calendar,
  ClipboardCheck,
  Mail,
  Bell,
  BarChart3,
  Settings,
  Info,
  Landmark,
  FolderArchive,
  UserCog,
  Network,
  Lock,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { CREATOR, APP_VERSION } from '@/lib/constants'
import type { AppView, UserRole } from '@/lib/constants'
import { canViewFinances, canViewMessages, canViewArchives, canManageUsers } from '@/lib/frontend-rbac'
import Image from 'next/image'
import { PwaInstallButton } from './pwa-install-button'
import { useState } from 'react'

interface NavItem {
  label: string
  icon: React.ElementType
  view: AppView
  showBadge?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Vue d’ensemble',
    items: [
      { label: 'Tableau de bord', icon: LayoutDashboard, view: 'dashboard' },
      { label: 'Notifications', icon: Bell, view: 'notifications', showBadge: true },
    ],
  },
  {
    label: 'Vie de l’église',
    items: [
      { label: 'Membres', icon: Users, view: 'members' },
      { label: 'Cartes Membres', icon: CreditCard, view: 'member-cards' },
      { label: 'Événements', icon: Calendar, view: 'events' },
      { label: 'Présences', icon: ClipboardCheck, view: 'attendance' },
      { label: 'Messages', icon: Mail, view: 'messages' },
    ],
  },
  {
    label: 'Finances',
    items: [
      { label: 'Finances', icon: DollarSign, view: 'finances' },
      { label: 'Dettes', icon: Landmark, view: 'debts' },
      { label: 'Rapports', icon: BarChart3, view: 'reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Mon Réseau', icon: Network, view: 'network' },
      { label: 'Utilisateurs', icon: UserCog, view: 'users-management' },
      { label: 'Archives', icon: FolderArchive, view: 'archives' },
      { label: 'Paramètres', icon: Settings, view: 'settings' },
    ],
  },
  {
    label: 'Aide',
    items: [{ label: 'À propos', icon: Info, view: 'about' }],
  },
]

export function AppSidebar() {
  const { currentView, setCurrentView, auth, unreadCount, isSubscriptionExpired } = useAppStore()
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  const fullName = auth.firstName && auth.lastName
    ? `${auth.firstName} ${auth.lastName}`
    : auth.email || 'Utilisateur'

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-gradient-to-b from-background to-background/80">
      {/* Header with church branding */}
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="relative h-9 w-9 flex-shrink-0">
            <Image
              src="/logo-mychurch.png"
              alt="MYCHURCH"
              fill
              className="object-contain rounded"
              priority
            />
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-sm font-bold truncate">
                {auth.churchName || 'MYCHURCH'}
              </span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium leading-none">
                v{APP_VERSION}
              </Badge>
            </div>
            <Badge variant="secondary" className="w-fit text-[10px] px-1.5 py-0 h-4 font-normal mt-0.5">
              {fullName}
            </Badge>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Navigation menu */}
      <SidebarContent>
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => {
                const role = auth.role as UserRole
                if (item.view === 'network') return role === 'admin'
                if (item.view === 'finances') return canViewFinances(role)
                if (item.view === 'messages') return canViewMessages(role)
                if (item.view === 'archives') return canViewArchives(role)
                if (item.view === 'users-management') return canManageUsers(role)
                // Expired accounts retain only the views needed to renew their subscription.
                if (isSubscriptionExpired && item.view !== 'dashboard' && item.view !== 'settings') return false
                return true
          })
          if (!visibleItems.length) return null
          const isCollapsed = collapsedSections[section.label]
          return (
            <SidebarGroup key={section.label} className="py-1">
              <SidebarGroupLabel
                asChild
                className="h-7 cursor-pointer select-none px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              >
                <button
                  type="button"
                  onClick={() => setCollapsedSections((current) => ({ ...current, [section.label]: !current[section.label] }))}
                  aria-expanded={!isCollapsed}
                >
                  <span className="group-data-[collapsible=icon]:hidden">{section.label}</span>
                  <span className="ml-auto text-xs group-data-[collapsible=icon]:hidden">{isCollapsed ? '+' : '−'}</span>
                </button>
              </SidebarGroupLabel>
              <SidebarGroupContent className={isCollapsed ? 'hidden' : undefined}>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                const isActive = currentView === item.view
                const isRestrictedBySub = false

                const FinanceIcon = (auth.currencySymbol === 'FC' || auth.churchCurrency === 'CDF')
                  ? Banknote
                  : (auth.currencySymbol === '€' || auth.churchCurrency === 'EUR')
                  ? Euro
                  : DollarSign

                const Icon = item.view === 'finances' ? FinanceIcon : item.icon

                return (
                  <SidebarMenuItem key={item.view}>
                    <div className="relative">
                      <div
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200 ${
                          isActive
                            ? 'h-6 bg-primary'
                            : 'h-0 bg-transparent'
                        }`}
                      />
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setCurrentView(item.view)}
                        tooltip={isRestrictedBySub ? `${item.label} (Abonnement requis)` : item.label}
                        className={`transition-all duration-200 ${isActive ? 'bg-primary/10' : ''} ${isRestrictedBySub ? 'opacity-70' : ''}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex items-center justify-between w-full pr-1">
                          <span className="truncate">{item.label}</span>
                          {item.showBadge && unreadCount > 0 && (
                            <Badge className="h-4 min-w-4 px-1 text-[9px] font-bold bg-destructive text-destructive-foreground hover:bg-destructive leading-none">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </Badge>
                          )}
                          {isRestrictedBySub && (
                            <Lock className="w-3 h-3 text-amber-500/80 shrink-0 ml-1" />
                          )}
                        </span>
                      </SidebarMenuButton>
                    </div>
                  </SidebarMenuItem>
                )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      {/* Footer with creator credit */}
      <SidebarFooter>
        <SidebarSeparator />
        <div className="p-3 group-data-[collapsible=icon]:p-2">
          <div className="group-data-[collapsible=icon]:hidden mb-2">
            <PwaInstallButton />
          </div>
          <p className="text-[10px] text-muted-foreground/70 text-center leading-tight group-data-[collapsible=icon]:hidden">
            {CREATOR} • v{APP_VERSION}
          </p>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}