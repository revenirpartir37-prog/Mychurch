'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/app-store'

// Lazy-load all page components to avoid a single massive chunk
const LandingPage = dynamic(
  () => import('@/components/mychurch/landing-page').then(m => ({ default: m.LandingPage })),
  { loading: () => <PageLoader /> }
)
const LoginPage = dynamic(
  () => import('@/components/mychurch/login-page').then(m => ({ default: m.LoginPage })),
  { loading: () => <PageLoader /> }
)
const RegisterPage = dynamic(
  () => import('@/components/mychurch/register-page').then(m => ({ default: m.RegisterPage })),
  { loading: () => <PageLoader /> }
)
const OtpPage = dynamic(
  () => import('@/components/mychurch/otp-page').then(m => ({ default: m.OtpPage })),
  { loading: () => <PageLoader /> }
)
const ForgotPasswordPage = dynamic(
  () => import('@/components/mychurch/forgot-password-page').then(m => ({ default: m.ForgotPasswordPage })),
  { loading: () => <PageLoader /> }
)
const DashboardLayout = dynamic(
  () => import('@/components/mychurch/dashboard/dashboard-layout').then(m => ({ default: m.DashboardLayout })),
  { loading: () => <PageLoader /> }
)
const DashboardPage = dynamic(
  () => import('@/components/mychurch/dashboard/dashboard-page').then(m => ({ default: m.DashboardPage })),
  { loading: () => <PageLoader /> }
)
const MembersPage = dynamic(
  () => import('@/components/mychurch/dashboard/members-page').then(m => ({ default: m.MembersPage })),
  { loading: () => <PageLoader /> }
)
const MemberCardsPage = dynamic(
  () => import('@/components/mychurch/dashboard/member-cards-page').then(m => ({ default: m.MemberCardsPage })),
  { loading: () => <PageLoader /> }
)
const FinancesPage = dynamic(
  () => import('@/components/mychurch/dashboard/finances-page').then(m => ({ default: m.FinancesPage })),
  { loading: () => <PageLoader /> }
)
const EventsPage = dynamic(
  () => import('@/components/mychurch/dashboard/events-page').then(m => ({ default: m.EventsPage })),
  { loading: () => <PageLoader /> }
)
const AttendancePage = dynamic(
  () => import('@/components/mychurch/dashboard/attendance-page').then(m => ({ default: m.AttendancePage })),
  { loading: () => <PageLoader /> }
)
const MessagesPage = dynamic(
  () => import('@/components/mychurch/dashboard/messages-page').then(m => ({ default: m.MessagesPage })),
  { loading: () => <PageLoader /> }
)
const ReportsPage = dynamic(
  () => import('@/components/mychurch/dashboard/reports-page').then(m => ({ default: m.ReportsPage })),
  { loading: () => <PageLoader /> }
)
const NotificationsPage = dynamic(
  () => import('@/components/mychurch/dashboard/notifications-page').then(m => ({ default: m.NotificationsPage })),
  { loading: () => <PageLoader /> }
)
const SettingsPage = dynamic(
  () => import('@/components/mychurch/dashboard/settings-page').then(m => ({ default: m.SettingsPage })),
  { loading: () => <PageLoader /> }
)
const AboutPage = dynamic(
  () => import('@/components/mychurch/dashboard/about-page').then(m => ({ default: m.AboutPage })),
  { loading: () => <PageLoader /> }
)
const DebtsPage = dynamic(
  () => import('@/components/mychurch/dashboard/debts-page').then(m => ({ default: m.DebtsPage })),
  { loading: () => <PageLoader /> }
)
const ArchivesPage = dynamic(
  () => import('@/components/mychurch/dashboard/archives-page').then(m => ({ default: m.ArchivesPage })),
  { loading: () => <PageLoader /> }
)
const UsersManagementPage = dynamic(
  () => import('@/components/mychurch/dashboard/users-management-page').then(m => ({ default: m.UsersManagementPage })),
  { loading: () => <PageLoader /> }
)

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

const DASHBOARD_VIEWS = new Set([
  'dashboard', 'members', 'member-cards', 'finances', 'debts', 'events',
  'attendance', 'messages', 'reports', 'notifications', 'settings', 'about',
  'archives', 'users-management',
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
    default: return <DashboardPage />
  }
}

export default function Home() {
  const { currentView, auth, setCurrentView } = useAppStore()

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

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // Unauthenticated views
  if (currentView === 'landing') return <LandingPage />
  if (currentView === 'login') return <LoginPage />
  if (currentView === 'register') return <RegisterPage />
  if (currentView === 'otp-verify') return <OtpPage />
  if (currentView === 'forgot-password') return <ForgotPasswordPage />

  // Authenticated views
  if (DASHBOARD_VIEWS.has(currentView) && auth.isAuthenticated) {
    return (
      <DashboardLayout>
        <DashboardView />
      </DashboardLayout>
    )
  }

  // Fallback
  return <LandingPage />
}