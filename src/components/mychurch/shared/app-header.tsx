'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Church, Bell, Menu, LogOut, Settings, User, Info, Search } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { ROLE_LABELS } from '@/lib/constants'
import type { UserRole } from '@/lib/constants'
import Image from 'next/image'
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime'

interface AppHeaderProps {
  onToggleSidebar?: () => void
}

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const { auth, unreadCount, setCurrentView, logout, setUnreadCount } = useAppStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fullName = auth.firstName && auth.lastName
    ? `${auth.firstName} ${auth.lastName}`
    : auth.email || 'Utilisateur'

  const initials = auth.firstName && auth.lastName
    ? `${auth.firstName[0]}${auth.lastName[0]}`
    : (auth.email?.[0]?.toUpperCase() || 'U')

  const roleLabel = auth.role ? ROLE_LABELS[auth.role as UserRole] : ''

  // Fetch unread count on mount and every 30 seconds
  useEffect(() => {
    if (!auth.token) return

    fetchUnreadCount()

    intervalRef.current = setInterval(fetchUnreadCount, 30000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [auth.token, setUnreadCount])

  async function fetchUnreadCount() {
    try {
      const res = await fetch('/api/notifications?isRead=false&limit=1', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.status === 401) {
        logout()
        return
      }
      if (res.ok) {
        const data = await res.json()
        const count = data.unreadCount ?? (data.notifications ?? data.data ?? []).length
        setUnreadCount(count)
      }
    } catch {
      // silent
    }
  }

  // Realtime : rafraîchit le compteur de notifications dès qu'une notification arrive (en + du polling 30s)
  useSupabaseRealtime(['notification'], () => fetchUnreadCount(), auth.churchId)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onToggleSidebar}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Church logo and name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="relative h-8 w-8 flex-shrink-0">
          <Image
            src="/logo-mychurch.png"
            alt="MYCHURCH"
            fill
            className="object-contain rounded"
            priority
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate">
            {auth.churchName || 'MYCHURCH'}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        {searchOpen ? (
          <div className="relative animate-[fadeInUp_0.6s_ease-out]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9 pr-8 h-9 w-48 sm:w-64"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchOpen(false)
                  setSearchQuery('')
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => { setSearchOpen(false); setSearchQuery('') }}
            >
              <span className="text-xs text-muted-foreground">✕</span>
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSearchOpen(true)}
            aria-label="Rechercher"
          >
            <Search className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setCurrentView('notifications')}
          aria-label="Notifications"
        >
          <Bell className={`h-5 w-5 ${unreadCount > 0 ? 'text-primary' : ''}`} />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] font-bold animate-pulse"
              variant="destructive"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src="" alt={fullName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <div className="flex flex-col gap-1 p-2">
              <p className="text-sm font-medium leading-none">{fullName}</p>
              {roleLabel && (
                <p className="text-xs text-muted-foreground leading-none mt-1">
                  {roleLabel}
                </p>
              )}
              <p className="text-xs text-muted-foreground leading-none mt-1 truncate">
                {auth.email}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCurrentView('dashboard')}>
              <User className="mr-2 h-4 w-4" />
              Mon profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentView('settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentView('about')}>
              <Info className="mr-2 h-4 w-4" />
              À propos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}