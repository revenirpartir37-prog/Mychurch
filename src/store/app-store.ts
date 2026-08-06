import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { auth } from '@/firebase'
import { signOut } from 'firebase/auth'
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
          auth: { ...state.auth, ...partial, isAuthenticated: !!partial.token },
        })),
      logout: () => {
        if (auth) {
          signOut(auth).catch((e) => console.warn('Firebase signOut failed:', e))
        }
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
    }),
    {
      name: 'mychurch-storage',
      partialize: (state) => ({
        auth: state.auth,
        theme: state.theme,
      }),
    }
  )
)