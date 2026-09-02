'use client'

import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar'
import { AppSidebar } from '../shared/app-sidebar'
import { AppHeader } from '../shared/app-header'
import { GlobalSearch } from '../shared/global-search'
import { NotificationsPrompt } from '../shared/notifications-prompt'

import { SubscriptionGuard } from './subscription-guard'

function SidebarToggleBridge() {
  const { toggleSidebar } = useSidebar()
  return <AppHeader onToggleSidebar={toggleSidebar} />
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SidebarToggleBridge />
        <SubscriptionGuard>
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </SubscriptionGuard>
        <GlobalSearch />
        <NotificationsPrompt />
      </SidebarInset>
    </SidebarProvider>
  )
}