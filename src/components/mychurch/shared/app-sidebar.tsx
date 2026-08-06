'use client'

import { useEffect } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
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
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { CREATOR } from '@/lib/constants'
import type { AppView, UserRole } from '@/lib/constants'
import { canViewFinances, canViewMessages, canViewArchives, canManageUsers } from '@/lib/frontend-rbac'
import Image from 'next/image'
import { PwaInstallButton } from './pwa-install-button'

interface NavItem {
  label: string
  icon: React.ElementType
  view: AppView
  showBadge?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', icon: LayoutDashboard, view: 'dashboard' },
  { label: 'Membres', icon: Users, view: 'members' },
  { label: 'Cartes Membres', icon: CreditCard, view: 'member-cards' },
  { label: 'Finances', icon: DollarSign, view: 'finances' },
  { label: 'Dettes', icon: Landmark, view: 'debts' },
  { label: 'Événements', icon: Calendar, view: 'events' },
  { label: 'Présences', icon: ClipboardCheck, view: 'attendance' },
  { label: 'Messages', icon: Mail, view: 'messages' },
  { label: 'Notifications', icon: Bell, view: 'notifications', showBadge: true },
  { label: 'Rapports', icon: BarChart3, view: 'reports' },
  { label: 'Archives', icon: FolderArchive, view: 'archives' },
  { label: 'Utilisateurs', icon: UserCog, view: 'users-management' },
  { label: 'Paramètres', icon: Settings, view: 'settings' },
  { label: 'À propos', icon: Info, view: 'about' },
]

export function AppSidebar() {
  const { currentView, setCurrentView, auth, unreadCount, setUnreadCount } = useAppStore()

  const fullName = auth.firstName && auth.lastName
    ? `${auth.firstName} ${auth.lastName}`
    : auth.email || 'Utilisateur'

  // Fetch unread notification count on mount
  useEffect(() => {
    if (!auth.token) return

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch('/api/notifications?isRead=false&limit=1', {
          headers: { Authorization: `Bearer ${auth.token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const count = data.unreadCount ?? (data.notifications ?? data.data ?? []).length
          setUnreadCount(count)
        }
      } catch {
        // silent
      }
    }

    fetchUnreadCount()
  }, [auth.token, setUnreadCount])

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
                v1.0
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.filter((item) => {
                const role = auth.role as UserRole
                if (item.view === 'finances') return canViewFinances(role)
                if (item.view === 'messages') return canViewMessages(role)
                if (item.view === 'archives') return canViewArchives(role)
                if (item.view === 'users-management') return canManageUsers(role)
                return true
              }).map((item) => {
                const isActive = currentView === item.view
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
                        tooltip={item.label}
                        className={`transition-all duration-200 ${isActive ? 'bg-primary/10' : ''}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="flex items-center gap-2">{item.label}
                          {item.showBadge && unreadCount > 0 && (
                            <Badge className="h-4 min-w-4 px-1 text-[9px] font-bold bg-destructive text-destructive-foreground hover:bg-destructive leading-none">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </Badge>
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
      </SidebarContent>

      {/* Footer with creator credit */}
      <SidebarFooter>
        <SidebarSeparator />
        <div className="p-3 group-data-[collapsible=icon]:p-2">
          <div className="group-data-[collapsible=icon]:hidden mb-2">
            <PwaInstallButton />
          </div>
          <p className="text-[10px] text-muted-foreground/70 text-center leading-tight group-data-[collapsible=icon]:hidden">
            {CREATOR}
          </p>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}