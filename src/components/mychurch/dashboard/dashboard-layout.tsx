'use client'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '../shared/app-sidebar'
import { AppHeader } from '../shared/app-header'
import { GlobalSearch } from '../shared/global-search'
import { useState } from 'react'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
        <GlobalSearch />
      </SidebarInset>
    </SidebarProvider>
  )
}