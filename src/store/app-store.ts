import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppView, UserRole } from '@/lib/constants'

interface AuthState {
  token: string | null
  refreshToken: string | null
  userId: string | null
  churchId: string | null
  email: string | null
  role: UserRole | null
  churchName: string | null
  churchLogo: string | null
  firstName: string | null
  lastName: string | null
  churchCurrency: string | null
  currencySymbol: string | null
  isAuthenticated: boolean
  verified: boolean
  firebaseUid: string | null
}

interface AppState {
  auth: AuthState
  setAuth: (auth: Partial<AuthState>) => void
  logout: () => void
  refreshAccessToken: () => Promise<boolean>

  currentView: AppView
  setCurrentView: (view: AppView) => void

  pendingOtpEmail: string | null
  setPendingOtpEmail: (email: string | null) => void

  unreadCount: number
  setUnreadCount: (count: number) => void

  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  theme: 'professional' | 'light' | 'dark'
  setTheme: (theme: 'professional' | 'light' | 'dark') => void

  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void

  isSubscriptionExpired: boolean
  setIsSubscriptionExpired: (expired: boolean) => void
}

const initialAuth: AuthState = {
  token: null,
  refreshToken: null,
  userId: null,
  churchId: null,
  email: null,
  role: null,
  churchName: null,
  churchLogo: null,
  firstName: null,
  lastName: null,
  churchCurrency: null,
  currencySymbol: null,
  isAuthenticated: false,
  verified: false,
  firebaseUid: null,
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const decoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let isRefreshing = false

function scheduleRefresh(expiresAt: number) {
  if (refreshTimer) clearTimeout(refreshTimer)
  const now = Date.now()
  const msUntilRefresh = Math.max(0, expiresAt - now - 5 * 60 * 1000)
  const msMax = expiresAt - now - 30_000
  const delay = Math.min(msUntilRefresh, Math.max(msMax, 60_000))
  refreshTimer = setTimeout(async () => {
    const state = useAppStore.getState()
    if (state.auth.isAuthenticated && state.auth.refreshToken) {
      await state.refreshAccessToken()
    }
  }, delay)
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      auth: initialAuth,
      setAuth: (partial) =>
        set((state) => ({
          auth: {
            ...state.auth,
            ...partial,
            isAuthenticated: partial.token !== undefined
              ? !!partial.token
              : state.auth.isAuthenticated,
          },
        })),

      logout: () => {
        if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null }
        import('@/firebase').then(({ auth }) => {
          if (auth) {
            import('firebase/auth').then(({ signOut }) => {
              signOut(auth).catch((e) => console.warn('Firebase signOut failed:', e))
            })
          }
        })
        set({ auth: initialAuth, currentView: 'landing' })
      },

      refreshAccessToken: async () => {
        const { auth } = get()
        if (!auth.refreshToken || !auth.isAuthenticated) return false
        if (isRefreshing) return false
        isRefreshing = true
        try {
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: auth.refreshToken }),
          })
          if (!res.ok) {
            get().logout()
            return false
          }
          const data = await res.json()
          set((state) => ({
            auth: { ...state.auth, token: data.accessToken, refreshToken: data.refreshToken },
          }))
          const payload = decodeJwtPayload(data.accessToken)
          if (payload?.exp) scheduleRefresh(payload.exp * 1000)
          return true
        } catch {
          get().logout()
          return false
        } finally {
          isRefreshing = false
        }
      },

      pendingOtpEmail: null as string | null,
      setPendingOtpEmail: (email) => set({ pendingOtpEmail: email }),

      currentView: 'landing',
      setCurrentView: (view) => set({ currentView: view }),

      unreadCount: 0,
      setUnreadCount: (count) => set({ unreadCount: count }),

      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      theme: 'professional',
      setTheme: (theme) => set({ theme }),

      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      isSubscriptionExpired: false,
      setIsSubscriptionExpired: (expired) => set({ isSubscriptionExpired: expired }),
    }),
    {
      name: 'mychurch-storage',
      partialize: (state) => ({
        auth: state.auth,
        theme: state.theme,
        currentView: state.currentView,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const tok = state.auth.token
          if (tok && state.auth.isAuthenticated) {
            const payload = decodeJwtPayload(tok)
            if (payload?.exp) {
              if (Date.now() >= payload.exp * 1000) {
                if (state.auth.refreshToken) {
                  state.refreshAccessToken()
                } else {
                  state.logout()
                }
              } else {
                scheduleRefresh(payload.exp * 1000)
              }
            }
          }
          state.setHasHydrated(true)
        }
      },
    }
  )
)
