'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Mail,
  Send,
  ArrowLeft,
  Search,
  Plus,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { EmptyState } from '@/components/mychurch/shared/empty-state'
import { canSendMessages } from '@/lib/frontend-rbac'

/* ─── Types ─── */

interface MessageSender {
  id: string
  firstName: string
  lastName: string
  photo?: string | null
  role?: string | null
}

interface Message {
  id: string
  subject: string
  content: string
  isRead: boolean
  isArchived: boolean
  createdAt: string
  senderId: string
  receiverId: string
  sender: MessageSender
  receiver: MessageSender
}

interface Conversation {
  peerId: string
  peer: MessageSender
  lastMessage: Message
  unreadCount: number
  messages: Message[]
}

interface MemberOption {
  id: string
  firstName: string
  lastName: string
  photo?: string | null
  department?: string | null
}

/* ─── Avatar color palette based on first letter ─── */

const AVATAR_PALETTE = [
  'bg-rose-500 text-white',
  'bg-amber-500 text-white',
  'bg-emerald-500 text-white',
  'bg-cyan-500 text-white',
  'bg-violet-500 text-white',
  'bg-orange-500 text-white',
  'bg-teal-500 text-white',
  'bg-pink-500 text-white',
  'bg-lime-600 text-white',
  'bg-fuchsia-500 text-white',
  'bg-red-500 text-white',
  'bg-green-600 text-white',
  'bg-yellow-500 text-white',
  'bg-stone-500 text-white',
  'bg-sky-500 text-white',
  'bg-indigo-500 text-white',
]

function getAvatarColor(name: string): string {
  const firstLetter = (name || '').charAt(0).toUpperCase()
  const code = firstLetter.charCodeAt(0)
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]
}

/* ─── Time formatting ─── */

function formatConversationTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const oneDay = 86400000

  if (diff < oneDay && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < 2 * oneDay) return 'Hier'
  if (diff < 7 * oneDay) {
    return d.toLocaleDateString('fr-FR', { weekday: 'short' })
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/* ─── Main Component ─── */

export function MessagesPage() {
  const { auth } = useAppStore()

  // All messages (inbox + sent, non-archived)
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [showMobileThread, setShowMobileThread] = useState(false)

  // New message dialog
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeSearch, setComposeSearch] = useState('')
  const [composeTo, setComposeTo] = useState('')
  const [composeContent, setComposeContent] = useState('')
  const [sending, setSending] = useState(false)

  // Members for compose
  const [members, setMembers] = useState<MemberOption[]>([])

  // Thread message input
  const [threadInput, setThreadInput] = useState('')
  const [sendingThread, setSendingThread] = useState(false)

  // Scroll ref for thread
  const threadEndRef = useRef<HTMLDivElement>(null)

  /* ─── Data fetching ─── */

  const fetchAllMessages = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch inbox (received, non-archived)
      const [inboxRes, sentRes] = await Promise.all([
        fetch('/api/messages?folder=inbox&limit=999', {
          headers: { Authorization: `Bearer ${auth.token}` },
        }),
        fetch('/api/messages?folder=sent&limit=999', {
          headers: { Authorization: `Bearer ${auth.token}` },
        }),
      ])

      let inboxMessages: Message[] = []
      let sentMessages: Message[] = []

      if (inboxRes.ok) {
        const data = await inboxRes.json()
        inboxMessages = data.messages || []
      }
      if (sentRes.ok) {
        const data = await sentRes.json()
        sentMessages = data.messages || []
      }

      // Merge and deduplicate
      const messageMap = new Map<string, Message>()
      for (const m of [...inboxMessages, ...sentMessages]) {
        if (!m.isArchived) {
          messageMap.set(m.id, m)
        }
      }
      const merged = Array.from(messageMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setAllMessages(merged)
    } catch {
      toast.error('Erreur de chargement des messages')
    } finally {
      setLoading(false)
    }
  }, [auth.token])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/members?limit=999', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || data.data || [])
      }
    } catch {
      // silent
    }
  }, [auth.token])

  useEffect(() => {
    fetchAllMessages()
  }, [fetchAllMessages])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  /* ─── Build conversations from messages ─── */

  const conversations = useMemo(() => {
    const myId = auth.userId
    const convMap = new Map<string, Conversation>()

    for (const msg of allMessages) {
      const isMine = msg.senderId === myId
      const peer = isMine ? msg.receiver : msg.sender
      const peerId = peer.id

      const existing = convMap.get(peerId)
      if (existing) {
        existing.messages.push(msg)
        // Update last message if this one is newer
        if (new Date(msg.createdAt).getTime() > new Date(existing.lastMessage.createdAt).getTime()) {
          existing.lastMessage = msg
        }
        // Count unread
        if (!isMine && !msg.isRead) {
          existing.unreadCount++
        }
      } else {
        convMap.set(peerId, {
          peerId,
          peer,
          lastMessage: msg,
          unreadCount: !isMine && !msg.isRead ? 1 : 0,
          messages: [msg],
        })
      }
    }

    // Sort each conversation's messages chronologically
    for (const conv of convMap.values()) {
      conv.messages.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    }

    // Sort conversations by last message time
    return Array.from(convMap.values()).sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    )
  }, [allMessages, auth.userId])

  /* ─── Filtered conversations ─── */

  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return conversations
    return conversations.filter((c) => {
      const name = `${c.peer.firstName} ${c.peer.lastName}`.toLowerCase()
      return name.includes(q)
    })
  }, [conversations, searchQuery])

  /* ─── Filtered members for compose ─── */

  const filteredMembers = useMemo(() => {
    const q = composeSearch.toLowerCase().trim()
    if (!q) return members
    return members.filter(
      (m) =>
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q)
    )
  }, [members, composeSearch])

  /* ─── Scroll to bottom of thread when conversation changes ─── */

  useEffect(() => {
    if (selectedConversation) {
      // Small delay to let the DOM render
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [selectedConversation])

  /* ─── Select conversation ─── */

  function handleSelectConversation(conv: Conversation) {
    setSelectedConversation(conv)
    setShowMobileThread(true)

    // Mark all unread in this conversation as read
    const unreadIds = conv.messages
      .filter((m) => m.senderId !== auth.userId && !m.isRead)
      .map((m) => m.id)

    if (unreadIds.length > 0) {
      Promise.all(
        unreadIds.map((id) =>
          fetch('/api/messages', {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${auth.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, isRead: true }),
          })
        )
      ).then(() => {
        setAllMessages((prev) =>
          prev.map((m) =>
            unreadIds.includes(m.id) ? { ...m, isRead: true } : m
          )
        )
        // Also update the selected conversation's unread count
        setSelectedConversation((prev) =>
          prev ? { ...prev, unreadCount: 0 } : prev
        )
      })
    }
  }

  /* ─── Send message in thread ─── */

  async function handleSendThreadMessage() {
    if (!selectedConversation || !threadInput.trim()) return

    setSendingThread(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId: selectedConversation.peerId,
          subject: selectedConversation.lastMessage.subject || 'Message',
          content: threadInput.trim(),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const newMsg: Message = data.message
        setThreadInput('')
        // Add to allMessages and update conversation
        setAllMessages((prev) => [newMsg, ...prev])
        setSelectedConversation((prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages, newMsg],
                lastMessage: newMsg,
              }
            : prev
        )
        // Scroll to bottom
        setTimeout(() => {
          threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur d'envoi")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSendingThread(false)
    }
  }

  /* ─── Compose new message ─── */

  async function handleComposeSend() {
    if (!composeTo || !composeContent.trim()) {
      toast.error('Veuillez sélectionner un destinataire et écrire un message')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId: composeTo,
          subject: 'Message',
          content: composeContent.trim(),
        }),
      })
      if (res.ok) {
        toast.success('Message envoyé')
        setComposeOpen(false)
        setComposeTo('')
        setComposeContent('')
        setComposeSearch('')
        fetchAllMessages()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur d'envoi")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSending(false)
    }
  }

  /* ─── Render: Conversation List Item ─── */

  function ConversationItem({ conv }: { conv: Conversation }) {
    const isActive = selectedConversation?.peerId === conv.peerId
    const peer = conv.peer
    const initials = `${peer.firstName[0]}${peer.lastName[0]}`
    const avatarColor = getAvatarColor(peer.firstName + peer.lastName)

    // Truncate last message content
    const lastContent =
      conv.lastMessage.content.length > 45
        ? conv.lastMessage.content.substring(0, 45) + '…'
        : conv.lastMessage.content

    return (
      <button
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 border-b border-border/50 ${
          isActive
            ? 'bg-primary/10'
            : 'hover:bg-muted/50'
        }`}
        onClick={() => handleSelectConversation(conv)}
      >
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11">
            {peer.photo && <AvatarImage src={peer.photo} alt={peer.firstName} />}
            <AvatarFallback className={`text-xs font-semibold ${avatarColor}`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          {conv.unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary/50 animate-ping" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-primary items-center justify-center text-[9px] font-bold text-primary-foreground">
                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
              </span>
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>
              {peer.firstName} {peer.lastName}
            </span>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {formatConversationTime(conv.lastMessage.createdAt)}
            </span>
          </div>
          <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? 'text-foreground/80' : 'text-muted-foreground'}`}>
            {lastContent}
          </p>
        </div>
      </button>
    )
  }

  /* ─── Render: Message Bubble ─── */

  function MessageBubble({
    message,
    showName,
    prevSenderId,
  }: {
    message: Message
    showName: boolean
    prevSenderId: string | null
  }) {
    const isMine = message.senderId === auth.userId
    const sender = message.sender
    const initials = `${sender.firstName[0]}${sender.lastName[0]}`
    const avatarColor = getAvatarColor(sender.firstName + sender.lastName)

    return (
      <div
        className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
      >
        {/* Avatar — only show if sender changed */}
        {showName ? (
          <Avatar className="h-8 w-8 shrink-0 mt-1">
            {sender.photo && <AvatarImage src={sender.photo} alt={sender.firstName} />}
            <AvatarFallback className={`text-[10px] font-semibold ${avatarColor}`}>
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-8 shrink-0" />
        )}

        <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
          {/* Sender name — only show if different from previous */}
          {showName && (
            <p className={`text-[11px] text-muted-foreground mb-1 ${isMine ? 'text-right' : 'text-left'}`}>
              {sender.firstName} {sender.lastName}
            </p>
          )}
          {/* Bubble */}
          <div
            className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
              isMine
                ? 'bg-primary text-primary-foreground rounded-l-xl rounded-tr-xl rounded-br-none'
                : 'bg-muted text-foreground rounded-r-xl rounded-tl-xl rounded-bl-none'
            }`}
          >
            {message.content}
          </div>
          {/* Timestamp */}
          <p className={`text-[10px] text-muted-foreground/60 mt-1 ${isMine ? 'text-right' : 'text-left'}`}>
            {formatMessageTime(message.createdAt)}
          </p>
        </div>
      </div>
    )
  }

  /* ─── Render: Thread panel ─── */

  function ThreadPanel() {
    if (!selectedConversation) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={Mail}
            title="Sélectionnez une conversation"
            description="Choisissez une conversation dans la liste pour commencer à discuter"
          />
        </div>
      )
    }

    const peer = selectedConversation.peer
    const peerInitials = `${peer.firstName[0]}${peer.lastName[0]}`
    const avatarColor = getAvatarColor(peer.firstName + peer.lastName)

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Thread header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background shrink-0">
          {/* Mobile back button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => {
              setShowMobileThread(false)
              setSelectedConversation(null)
            }}
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-9 w-9">
            {peer.photo && <AvatarImage src={peer.photo} alt={peer.firstName} />}
            <AvatarFallback className={`text-xs font-semibold ${avatarColor}`}>
              {peerInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {peer.firstName} {peer.lastName}
            </p>
            {peer.role && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 mt-0.5">
                {peer.role}
              </Badge>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
          {selectedConversation.messages.map((msg, idx) => {
            const prevMsg = idx > 0 ? selectedConversation.messages[idx - 1] : null
            const showName = !prevMsg || prevMsg.senderId !== msg.senderId
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                showName={showName}
                prevSenderId={prevMsg?.senderId ?? null}
              />
            )
          })}
          <div ref={threadEndRef} />
        </div>

        {/* Message input area */}
        <div className="border-t border-border/50 bg-background p-3 shrink-0">
          <div className="flex items-end gap-2">
            <Textarea
              value={threadInput}
              onChange={(e) => setThreadInput(e.target.value)}
              placeholder="Écrire un message..."
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendThreadMessage()
                }
              }}
            />
            <Button
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={handleSendThreadMessage}
              disabled={!threadInput.trim() || sendingThread}
              aria-label="Envoyer"
            >
              {sendingThread ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Render: Left panel skeleton ─── */

  function ConversationListSkeleton() {
    return (
      <div className="space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-11 w-11 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  /* ─── Main render ─── */

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-7rem)]">
      <div className="flex h-full border border-border/50 rounded-xl overflow-hidden bg-background">
        {/* ─── Left panel: Conversation list ─── */}
        <div
          className={`w-full md:w-80 border-r border-border/50 flex flex-col shrink-0 bg-background ${
            showMobileThread ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search */}
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une conversation..."
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <ConversationListSkeleton />
            ) : filteredConversations.length === 0 ? (
              <div className="py-10 px-4">
                <EmptyState
                  icon={MessageCircle}
                  title={
                    searchQuery
                      ? 'Aucune conversation trouvée'
                      : 'Aucune conversation'
                  }
                  description={
                    searchQuery
                      ? 'Essayez un autre terme de recherche'
                      : 'Vos conversations apparaîtront ici'
                  }
                />
              </div>
            ) : (
              <div>
                {filteredConversations.map((conv) => (
                  <ConversationItem key={conv.peerId} conv={conv} />
                ))}
              </div>
            )}
          </div>

          {/* New message button */}
          {canSendMessages(auth.role) && (
            <div className="p-3 border-t border-border/50">
              <Button
                className="w-full gap-2"
                onClick={() => setComposeOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Nouveau message
              </Button>
            </div>
          )}
        </div>

        {/* ─── Right panel: Thread ─── */}
        <div
          className={`flex-1 min-w-0 ${
            showMobileThread ? 'flex' : 'hidden md:flex'
          }`}
        >
          <ThreadPanel />
        </div>
      </div>

      {/* ─── New Message Dialog ─── */}
      <Dialog open={composeOpen} onOpenChange={(open) => {
        setComposeOpen(open)
        if (!open) {
          setComposeTo('')
          setComposeContent('')
          setComposeSearch('')
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau message</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Recipient search */}
            <div className="space-y-2">
              <Label>Destinataire</Label>
              <Input
                value={composeSearch}
                onChange={(e) => setComposeSearch(e.target.value)}
                placeholder="Rechercher un membre..."
                className="text-sm"
              />

              {/* Show selected or member list */}
              {composeTo ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10">
                  {(() => {
                    const member = members.find((m) => m.id === composeTo)
                    if (!member) return null
                    const initials = `${member.firstName[0]}${member.lastName[0]}`
                    return (
                      <>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className={`text-[10px] font-semibold ${getAvatarColor(member.firstName + member.lastName)}`}>
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium flex-1">
                          {member.firstName} {member.lastName}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setComposeTo('')}
                        >
                          ×
                        </Button>
                      </>
                    )
                  })()}
                </div>
              ) : (
                <ScrollArea className="max-h-40">
                  <div className="space-y-0.5">
                    {filteredMembers.slice(0, 10).map((m) => {
                      const initials = `${m.firstName[0]}${m.lastName[0]}`
                      return (
                        <button
                          key={m.id}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 text-left transition-colors"
                          onClick={() => {
                            setComposeTo(m.id)
                            setComposeSearch('')
                          }}
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className={`text-[10px] font-semibold ${getAvatarColor(m.firstName + m.lastName)}`}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm truncate">
                              {m.firstName} {m.lastName}
                            </p>
                            {m.department && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {m.department}
                              </p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Message content */}
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={composeContent}
                onChange={(e) => setComposeContent(e.target.value)}
                placeholder="Écrire votre message..."
                rows={4}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setComposeOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleComposeSend}
              disabled={!composeTo || !composeContent.trim() || sending}
              className="gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}