'use client'

import { useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/app-store'

// Shell critique: affiché immédiatement sans spinner plein écran (évite 1er paint bloqué)
function ShellLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    </div>
  )
}

// Critiques (1er affichage): loader léger inline, pas plein écran
const LandingPage = dynamic(() => import('@/components/mychurch/landing-page').then(m => ({ default: m.LandingPage })), { loading: () => <ShellLoader /> })
const LoginPage = dynamic(() => import('@/components/mychurch/login-page').then(m => ({ default: m.LoginPage })), { loading: () => <ShellLoader /> })
const RegisterPage = dynamic(() => import('@/components/mychurch/register-page').then(m => ({ default: m.RegisterPage })), { loading: () => <ShellLoader /> })
const OtpPage = dynamic(() => import('@/components/mychurch/otp-page').then(m => ({ default: m.OtpPage })), { loading: () => <ShellLoader /> })
const ForgotPasswordPage = dynamic(() => import('@/components/mychurch/forgot-password-page').then(m => ({ default: m.ForgotPasswordPage })), { loading: () => <ShellLoader /> })
// Shell critique: layout léger, charge vite
const DashboardLayout = dynamic(() => import('@/components/mychurch/dashboard/dashboard-layout').then(m => ({ default: m.DashboardLayout })), { loading: () => <ShellLoader /> })
// Lourds: code-split, Suspense au point d'usage (pas de spinner plein écran sur 1er paint)
const DashboardPage = dynamic(() => import('@/components/mychurch/dashboard/dashboard-page').then(m => ({ default: m.DashboardPage })), { loading: () => <ShellLoader /> })
const MembersPage = dynamic(() => import('@/components/mychurch/dashboard/members-page').then(m => ({ default: m.MembersPage })), { loading: () => <ShellLoader /> })
const FinancesPage = dynamic(() => import('@/components/mychurch/dashboard/finances-page').then(m => ({ default: m.FinancesPage })), { loading: () => <ShellLoader /> })
const ReportsPage = dynamic(() => import('@/components/mychurch/dashboard/reports-page').then(m => ({ default: m.ReportsPage })), { loading: () => <ShellLoader /> })
// Secondaires: même stratégie légère
const MemberCardsPage = dynamic(() => import('@/components/mychurch/dashboard/member-cards-page').then(m => ({ default: m.MemberCardsPage })), { loading: () => <ShellLoader /> })
const EventsPage = dynamic(() => import('@/components/mychurch/dashboard/events-page').then(m => ({ default: m.EventsPage })), { loading: () => <ShellLoader /> })
const AttendancePage = dynamic(() => import('@/components/mychurch/dashboard/attendance-page').then(m => ({ default: m.AttendancePage })), { loading: () => <ShellLoader /> })
const MessagesPage = dynamic(() => import('@/components/mychurch/dashboard/messages-page').then(m => ({ default: m.MessagesPage })), { loading: () => <ShellLoader /> })
const NotificationsPage = dynamic(() => import('@/components/mychurch/dashboard/notifications-page').then(m => ({ default: m.NotificationsPage })), { loading: () => <ShellLoader /> })
const SettingsPage = dynamic(() => import('@/components/mychurch/dashboard/settings-page').then(m => ({ default: m.SettingsPage })), { loading: () => <ShellLoader /> })
const AboutPage = dynamic(() => import('@/components/mychurch/dashboard/about-page').then(m => ({ default: m.AboutPage })), { loading: () => <ShellLoader /> })
const DebtsPage = dynamic(() => import('@/components/mychurch/dashboard/debts-page').then(m => ({ default: m.DebtsPage })), { loading: () => <ShellLoader /> })
const ArchivesPage = dynamic(() => import('@/components/mychurch/dashboard/archives-page').then(m => ({ default: m.ArchivesPage })), { loading: () => <ShellLoader /> })
const UsersManagementPage = dynamic(() => import('@/components/mychurch/dashboard/users-management-page').then(m => ({ default: m.UsersManagementPage })), { loading: () => <ShellLoader /> })
const NetworkPage = dynamic(() => import('@/components/mychurch/dashboard/network-page').then(m => ({ default: m.NetworkPage })), { loading: () => <ShellLoader /> })

const DASHBOARD_VIEWS = new Set([
  'dashboard', 'members', 'member-cards', 'finances', 'debts', 'events',
  'attendance', 'messages', 'reports', 'notifications', 'settings', 'about',
  'archives', 'users-management', 'network',
])

function DashboardView() {
  const { currentView } = useAppStore()

  switch (currentView) {
    case 'dashboard': return <DashboardPage />
    case 'members': return <MembersPage />
    case 'member-cards': return <MemberCardsPage />
    case 'finances': return <FinancesPage />
    case 'debts': return <DebtsPage />
    case 'events': return <EventsPage />
    case 'attendance': return <AttendancePage />
    case 'messages': return <MessagesPage />
    case 'reports': return <ReportsPage />
    case 'notifications': return <NotificationsPage />
    case 'settings': return <SettingsPage />
    case 'about': return <AboutPage />
    case 'archives': return <ArchivesPage />
    case 'users-management': return <UsersManagementPage />
    case 'network': return <NetworkPage />
    default: return <DashboardPage />
  }
}

export default function Home() {
  const { currentView, auth, setCurrentView, hasHydrated } = useAppStore()

  // Restaure la session : si déjà authentifié et aucune vue active, aller au dashboard.
  useEffect(() => {
    if (auth.isAuthenticated && (currentView === 'landing' || currentView === 'login')) {
      setCurrentView('dashboard')
    }
  }, [auth.isAuthenticated, currentView, setCurrentView])

  // Handle redirect from GeniusPay payment (reads ?view= and ?payment= params)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const view = params.get('view')
    if (view && auth.isAuthenticated) {
      setCurrentView(view as any)
    }
    // Don't clean URL here - child components read ?payment= param
  }, [auth.isAuthenticated, setCurrentView])

  // Service worker enregistré une seule fois via layout.tsx -> /register-sw.js

  if (!hasHydrated) return <ShellLoader />

  // Unauthenticated views
  if (currentView === 'landing') return <LandingPage />
  if (currentView === 'login') return <LoginPage />
  if (currentView === 'register') return <RegisterPage />
  if (currentView === 'otp-verify') return <OtpPage />
  if (currentView === 'forgot-password') return <ForgotPasswordPage />

  // Authenticated views — Suspense évite spinner plein écran inutile sur navigation interne
  if (DASHBOARD_VIEWS.has(currentView) && auth.isAuthenticated) {
    return (
      <DashboardLayout>
        <Suspense fallback={<ShellLoader />}>
          <DashboardView />
        </Suspense>
      </DashboardLayout>
    )
  }

  // Fallback
  return <LandingPage />
}