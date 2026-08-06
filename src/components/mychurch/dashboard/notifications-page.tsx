'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bell,
  CheckCheck,
  Trash2,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'

interface ChurchNotification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
}

/* ─── Type → Icon mapping ─── */

function getNotificationIcon(type: string) {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-emerald-500" />
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />
    default:
      return <Info className="h-5 w-5 text-teal-500" />
  }
}

/* ─── Type → Left border color ─── */

function getTypeBorderColor(type: string): string {
  switch (type) {
    case 'success':
      return 'border-l-emerald-500'
    case 'warning':
      return 'border-l-amber-500'
    case 'error':
      return 'border-l-red-500'
    default:
      return 'border-l-teal-500'
  }
}

/* ─── Time formatting ─── */

function formatTimestamp(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  if (diffHr < 24) return `Il y a ${diffHr}h`
  if (diffDay < 7) return `Il y a ${diffDay}j`
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function NotificationsPage() {
  const auth = useAppStore((s) => s.auth)
  const setUnreadCount = useAppStore((s) => s.setUnreadCount)

  const [notifications, setNotifications] = useState<ChurchNotification[]>([])
  const [unreadCount, setLocalUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const list: ChurchNotification[] = data.notifications ?? data.data ?? data ?? []
        setNotifications(list)
        const count = data.unreadCount ?? list.filter((n) => !n.isRead).length
        setLocalUnreadCount(count)
        setUnreadCount(count)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [auth.token, setUnreadCount])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    const notif = notifications.find((n) => n.id === id)
    if (!notif || notif.isRead) return

    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ ids: [id] }),
      })
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        )
        setLocalUnreadCount((c) => {
          const newCount = Math.max(0, c - 1)
          setUnreadCount(newCount)
          return newCount
        })
      }
    } catch {
      // silent
    }
  }

  const markAllAsRead = async () => {
    if (unreadCount === 0) return

    setMarkingAll(true)
    try {
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        setLocalUnreadCount(0)
        setUnreadCount(0)
      }
    } catch {
      // silent
    } finally {
      setMarkingAll(false)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        const removed = notifications.find((n) => n.id === id)
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        if (removed && !removed.isRead) {
          setLocalUnreadCount((c) => {
            const newCount = Math.max(0, c - 1)
            setUnreadCount(newCount)
            return newCount
          })
        }
      }
    } catch {
      // silent
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50">
              <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="bg-destructive text-destructive-foreground hover:bg-destructive">
              {unreadCount}
            </Badge>
          )}
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={markingAll}
            className="gap-2"
          >
            {markingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            {markingAll ? 'Marquage...' : 'Tout marquer comme lu'}
          </Button>
        )}
      </div>

      <Separator />

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-l-4 border-l-transparent">
              <CardContent className="flex items-start gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium text-muted-foreground">Aucune notification</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Vos notifications apparaîtront ici
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)] max-h-[640px]">
          <div className="space-y-2 pr-4">
            {notifications.map((notif) => (
              <Card
                key={notif.id}
                className={`cursor-pointer transition-all duration-200 hover:bg-muted/50 border-l-4 ${getTypeBorderColor(notif.type)} ${
                  !notif.isRead ? 'bg-primary/5 dark:bg-primary/5' : ''
                }`}
                onClick={() => markAsRead(notif.id)}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  {/* Type icon */}
                  <div className="flex-shrink-0">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      !notif.isRead ? 'bg-muted' : 'bg-muted/60'
                    }`}>
                      {getNotificationIcon(notif.type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium leading-tight ${
                            notif.isRead ? 'text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {notif.title}
                        </p>
                        <p
                          className={`mt-1 text-sm leading-relaxed ${
                            notif.isRead ? 'text-muted-foreground/70' : 'text-foreground/80'
                          }`}
                        >
                          {notif.message}
                        </p>
                      </div>

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNotification(notif.id)
                        }}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground/60">
                      {formatTimestamp(notif.createdAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}