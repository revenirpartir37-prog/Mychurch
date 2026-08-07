'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Mail, Phone, MapPin, CalendarDays, Building2, Briefcase,
  UserCheck, Wallet, Clock,
} from 'lucide-react'
import { EmptyState } from '@/components/mychurch/shared/empty-state'
import { REVENUE_LABELS, EXPENSE_LABELS } from '@/lib/constants'

interface Member {
  id: string
  firstName: string
  lastName: string
  type?: string
  phone: string | null
  email: string | null
  address: string | null
  department: string | null
  function: string | null
  salary?: number | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  photo: string | null
  status: string
  joinDate: string
}

interface AttendanceRecord {
  id: string
  status: string
  date: string
  notes: string | null
  event: { title: string } | null
}

interface TransactionRecord {
  id: string
  type: string
  category: string
  amount: number
  currency: string
  description: string | null
  date: string
}

interface MemberDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: Member | null
  token: string
}

const AVATAR_PALETTE = [
  'bg-rose-500 text-white',
  'bg-amber-500 text-white',
  'bg-emerald-500 text-white',
  'bg-cyan-500 text-white',
  'bg-violet-500 text-white',
  'bg-orange-500 text-white',
  'bg-teal-500 text-white',
  'bg-pink-500 text-white',
  'bg-indigo-500 text-white',
  'bg-lime-600 text-white',
  'bg-fuchsia-500 text-white',
  'bg-sky-500 text-white',
  'bg-red-500 text-white',
  'bg-green-600 text-white',
  'bg-yellow-500 text-white',
  'bg-purple-500 text-white',
  'bg-blue-500 text-white',
  'bg-stone-500 text-white',
  'bg-olive-600 text-white',
  'bg-coral-500 text-white',
]

function getAvatarColor(name: string): string {
  const firstLetter = (name || '').charAt(0).toUpperCase()
  const code = firstLetter.charCodeAt(0)
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]
}

function getCategoryLabel(category: string, type: string): string {
  if (type === 'revenue') {
    return (REVENUE_LABELS as Record<string, string>)[category] || category
  }
  return (EXPENSE_LABELS as Record<string, string>)[category] || category
}

function AttendanceStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    present: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
    late: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
    absent: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400',
  }
  const labels: Record<string, string> = {
    present: 'Présent',
    late: 'En retard',
    absent: 'Absent',
  }

  return (
    <Badge variant="outline" className={config[status] || config.absent}>
      {labels[status] || status}
    </Badge>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/60 shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm mt-0.5 truncate">{value || <span className="text-muted-foreground">Non renseigné</span>}</p>
      </div>
    </div>
  )
}

export function MemberDetailDrawer({ open, onOpenChange, member, token }: MemberDetailDrawerProps) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!member) return
    setLoading(true)
    try {
      const [attRes, txRes] = await Promise.all([
        fetch(`/api/attendance?memberId=${member.id}&limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/finances?memberId=${member.id}&limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ])

      if (attRes.ok) {
        const attData = await attRes.json()
        setAttendance(attData.records || [])
      } else {
        setAttendance([])
      }

      if (txRes.ok) {
        const txData = await txRes.json()
        setTransactions(txData.transactions || [])
      } else {
        setTransactions([])
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [member, token])

  useEffect(() => {
    if (open && member) {
      fetchData()
    } else {
      setAttendance([])
      setTransactions([])
    }
  }, [open, member, fetchData])

  const initials = member
    ? `${member.firstName[0] || ''}${member.lastName[0] || ''}`.toUpperCase()
    : ''

  const fullName = member
    ? `${member.firstName} ${member.lastName}`
    : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 overflow-y-auto"
      >
        {member && (
          <>
            {/* ─── Header Section ─── */}
            <SheetHeader className="p-5 pb-0">
              <SheetTitle className="sr-only">{initials}</SheetTitle>
              <SheetDescription className="sr-only">
                Détails du membre {fullName}
              </SheetDescription>
            </SheetHeader>

            <div className="px-5 pt-2 pb-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 shrink-0">
                  {member.photo && <AvatarImage src={member.photo} alt={fullName} />}
                  <AvatarFallback className={`text-lg ${getAvatarColor(member.firstName + member.lastName)}`}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold truncate leading-tight">{fullName}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                      {member.status === 'active' ? 'Actif' : 'Inactif'}
                    </Badge>
                    <Badge variant="outline" className="text-xs gap-1">
                      {member.type === 'personnel' ? 'Personnel' : 'Membre'}
                    </Badge>
                    {member.department && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Building2 className="h-3 w-3" />
                        {member.department}
                      </Badge>
                    )}
                    {member.function && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Briefcase className="h-3 w-3" />
                        {member.function}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* ─── Informations Section ─── */}
            <div className="px-5 py-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Informations
              </h3>
              <div className="space-y-0">
                <InfoRow icon={Mail} label="Email" value={member.email} />
                <InfoRow icon={Phone} label="Téléphone" value={member.phone} />
                <InfoRow icon={MapPin} label="Adresse" value={member.address} />
                {member.type === 'personnel' && member.salary != null && (
                  <InfoRow icon={Wallet} label="Salaire" value={`${member.salary.toLocaleString('fr-FR')} USD`} />
                )}
                {member.emergencyContactName || member.emergencyContactPhone ? (
                  <InfoRow
                    icon={Phone}
                    label="Contact d'urgence"
                    value={[member.emergencyContactName, member.emergencyContactPhone].filter(Boolean).join(' · ') || null}
                  />
                ) : null}
                <InfoRow
                  icon={CalendarDays}
                  label="Date d'inscription"
                  value={member.joinDate ? format(new Date(member.joinDate), 'dd MMMM yyyy', { locale: fr }) : null}
                />
              </div>
            </div>

            <Separator />

            {/* ─── Historique des présences ─── */}
            <div className="px-5 py-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" />
                Historique des présences
              </h3>

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-28 flex-1" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : attendance.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Aucune présence enregistrée"
                  description="Les présences de ce membre apparaîtront ici"
                  className="py-6"
                />
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {attendance.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {record.event?.title || 'Événement inconnu'}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {format(new Date(record.date), 'dd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                      <AttendanceStatusBadge status={record.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* ─── Historique des transactions ─── */}
            <div className="px-5 py-4 pb-8">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Historique des transactions
              </h3>

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24 flex-1" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Aucune transaction"
                  description="Les transactions de ce membre apparaîtront ici"
                  className="py-6"
                />
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {getCategoryLabel(tx.category, tx.type)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {format(new Date(tx.date), 'dd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${
                          tx.type === 'revenue'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {tx.type === 'revenue' ? '+' : '-'}
                        {tx.amount.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {tx.currency}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}