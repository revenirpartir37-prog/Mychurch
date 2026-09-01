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
  isAuthenticated: boolean
  verified: boolean
  firebaseUid: string | null
}

interface AppState {
  // Auth
  auth: AuthState
  setAuth: (auth: Partial<AuthState>) => void
  logout: () => void

  // Navigation
  currentView: AppView
  setCurrentView: (view: AppView) => void

  // OTP pending verification
  pendingOtpEmail: string | null
  setPendingOtpEmail: (email: string | null) => void

  // Notifications
  unreadCount: number
  setUnreadCount: (count: number) => void

  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Theme
  theme: 'professional' | 'light' | 'dark'
  setTheme: (theme: 'professional' | 'light' | 'dark') => void

  // Hydration
  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
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
  isAuthenticated: false,
  verified: false,
  firebaseUid: null,
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      auth: initialAuth,
      setAuth: (partial) =>
        set((state) => ({
          auth: {
            ...state.auth,
            ...partial,
            // Ne modifie isAuthenticated QUE si un token (ou une déconnexion) est explicitement passé.
            // Une mise à jour partielle (ex. logo) doit préserver l'état de connexion existant.
            isAuthenticated: partial.token !== undefined
              ? !!partial.token
              : state.auth.isAuthenticated,
          },
        })),
      logout: () => {
        // Lazy firebase — évite d'inclure tout le SDK dans le chunk partagé initial
        import('@/firebase').then(({ auth }) => {
          if (auth) {
            import('firebase/auth').then(({ signOut }) => {
              signOut(auth).catch((e) => console.warn('Firebase signOut failed:', e))
            })
          }
        })
        set({
          auth: initialAuth,
          currentView: 'landing',
        })
      },

      pendingOtpEmail: null as string | null,
      setPendingOtpEmail: (email: string | null) => set({ pendingOtpEmail: email }),

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
          // Centralise validation expiration: token expiré → logout propre, évite Bearer expiré
          try {
            const tok = state.auth.token
            if (tok) {
              const parts = tok.split('.')
              if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
                if (payload.exp && Date.now() >= payload.exp * 1000) {
                  state.auth = { ...initialAuth }
                  state.currentView = 'landing'
                }
              }
            }
          } catch {}
          state.setHasHydrated(true)
        }
      },
    }
  )
)