'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAppStore } from '@/store/app-store'
import type { AttendanceStatus } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CheckCircle,
  XCircle,
  Clock,
  Save,
  Users,
  ClipboardCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarX,
  LayoutGrid,
  List,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import { addDays, subDays, format, isToday, startOfWeek, addWeeks, subWeeks, endOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { EmptyState } from '@/components/mychurch/shared/empty-state'
import { canCreateAttendance, canEditAttendance } from '@/lib/frontend-rbac'

interface Member {
  id: string
  firstName: string
  lastName: string
  photo: string | null
}

interface ChurchEvent {
  id: string
  title: string
  type: string
  startDate: string
}

interface HeatmapMember {
  id: string
  firstName: string
  lastName: string
  days: { date: string; status: string | null }[]
}

interface HeatmapData {
  dates: string[]
  members: HeatmapMember[]
}

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

const STATUS_BORDER_COLORS: Record<AttendanceStatus, string> = {
  present: 'border-l-green-500',
  absent: 'border-l-red-500',
  late: 'border-l-amber-500',
}

const STATUS_BG_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-50/60 dark:bg-green-950/10',
  absent: 'bg-red-50/60 dark:bg-red-950/10',
  late: 'bg-amber-50/60 dark:bg-amber-950/10',
}

// Animated progress circle with effect-based mount animation
function AnimatedCircularProgress({
  value,
  color,
  size = 56,
  strokeWidth = 5,
}: {
  value: number
  color: string
  size?: number
  strokeWidth?: number
}) {
  const [animatedOffset, setAnimatedOffset] = useState<number | null>(null)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const targetOffset = circumference - (value / 100) * circumference

  useEffect(() => {
    // Start from full offset (empty), animate to target
    const timer = requestAnimationFrame(() => {
      setAnimatedOffset(targetOffset)
    })
    return () => cancelAnimationFrame(timer)
  }, [targetOffset])

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset ?? circumference}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold">{Math.round(value)}%</span>
      </div>
    </div>
  )
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const HEATMAP_STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-500',
  absent: 'bg-red-500',
  late: 'bg-amber-500',
}

const HEATMAP_STATUS_LABELS: Record<string, string> = {
  present: 'Présent',
  absent: 'Absent',
  late: 'En retard',
}

function formatWeekRange(weekOffset: number): string {
  const ref = new Date()
  ref.setHours(0, 0, 0, 0)
  const monday = startOfWeek(ref, { weekStartsOn: 1 })
  const weekMonday = addWeeks(monday, weekOffset)
  const weekSunday = endOfWeek(weekMonday, { weekStartsOn: 1 })
  return `${format(weekMonday, 'd MMM', { locale: fr })} – ${format(weekSunday, 'd MMM yyyy', { locale: fr })}`
}

/* ─── Weekly Statistics Card ─── */
function WeeklyStatsCard({ data }: { data: HeatmapData | null }) {
  if (!data || data.members.length === 0) return null

  // Calculate per-day attendance rates
  const dayStats = data.dates.map((dateStr, dayIndex) => {
    const statuses = data.members.map(m => m.days[dayIndex]?.status)
    const presentCount = statuses.filter(s => s === 'present').length
    const lateCount = statuses.filter(s => s === 'late').length
    const totalWithData = statuses.filter(s => s !== null).length
    const rate = totalWithData > 0 ? ((presentCount + lateCount) / totalWithData) * 100 : 0
    const d = new Date(dateStr + 'T00:00:00')
    const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' })
    return { date: dateStr, dayName, rate, presentCount, lateCount, totalWithData }
  })

  const validDays = dayStats.filter(d => d.totalWithData > 0)
  const bestDay = validDays.reduce((best, d) => d.rate > best.rate ? d : best, validDays[0])
  const worstDay = validDays.reduce((worst, d) => d.rate < worst.rate ? d : worst, validDays[0])
  const avgRate = validDays.length > 0
    ? Math.round(validDays.reduce((sum, d) => sum + d.rate, 0) / validDays.length)
    : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Statistiques hebdomadaires
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Best day */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Meilleur jour</p>
              <p className="text-sm font-semibold capitalize">{bestDay?.dayName}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {bestDay?.rate.toFixed(0)}% de présence
              </p>
            </div>
          </div>
          {/* Worst day */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50/60 dark:bg-red-950/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jour le plus faible</p>
              <p className="text-sm font-semibold capitalize">{worstDay?.dayName}</p>
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {worstDay?.rate.toFixed(0)}% de présence
              </p>
            </div>
          </div>
          {/* Average */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taux moyen</p>
              <p className="text-sm font-semibold">{avgRate}%</p>
              <p className="text-xs text-muted-foreground">
                sur {validDays.length} jour(s) avec données
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Heatmap View Component ─── */
function HeatmapView({ weekOffset, onWeekChange }: { weekOffset: number; onWeekChange: (offset: number) => void }) {
  const auth = useAppStore((s) => s.auth)
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null)
  const [loading, setLoading] = useState(true)

  const authHeaders = {
    Authorization: `Bearer ${auth.token}`,
  }

  const fetchHeatmap = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance/heatmap?weekOffset=${weekOffset}`, {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setHeatmapData(data)
    } catch {
      toast.error('Erreur lors du chargement de la heatmap')
    } finally {
      setLoading(false)
    }
  }, [weekOffset, auth.token])

  useEffect(() => {
    if (auth.token) fetchHeatmap()
  }, [fetchHeatmap, auth.token])

  return (
    <>
      {/* Weekly Stats Card */}
      {!loading && heatmapData && heatmapData.members.length > 0 && (
        <WeeklyStatsCard data={heatmapData} />
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Heatmap hebdomadaire
            </CardTitle>
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onWeekChange(weekOffset - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[160px] text-center">
                {formatWeekRange(weekOffset)}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onWeekChange(weekOffset + 1)} disabled={weekOffset >= 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-green-500" />
              Présent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-red-500" />
              Absent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-amber-500" />
              En retard
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-muted" />
              Aucune donnée
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-2">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <Skeleton key={j} className="h-8 w-8 rounded" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !heatmapData || heatmapData.members.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title="Aucune donnée de présence pour cette semaine"
              description="Les données apparaîtront une fois les présences enregistrées"
            />
          ) : (
            <div className="overflow-x-auto">
              {/* Day headers */}
              <div className="flex items-center gap-3 mb-3 pl-[140px]">
                {heatmapData.dates.map((dateStr, i) => {
                  const d = new Date(dateStr + 'T00:00:00')
                  const dayLabel = isToday(d) ? 'Auj.' : DAY_NAMES[i]
                  return (
                    <div
                      key={dateStr}
                      className={`w-8 text-center text-xs font-medium shrink-0 ${isToday(d) ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      <div>{dayLabel}</div>
                      <div className="text-[10px]">{d.getDate()}</div>
                    </div>
                  )
                })}
              </div>

              {/* Member rows with alternating backgrounds */}
              <div className="max-h-[480px] overflow-y-auto space-y-1.5">
                {heatmapData.members.map((member, memberIndex) => (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 px-1.5 py-1 rounded-md ${memberIndex % 2 === 0 ? 'bg-muted/20' : ''}`}
                  >
                    {/* Member name */}
                    <div className="w-[140px] shrink-0 flex items-center gap-2 min-w-0">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(member.firstName, member.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate" title={`${member.firstName} ${member.lastName}`}>
                        {member.firstName} {member.lastName}
                      </span>
                    </div>

                    {/* Day cells with enhanced tooltips */}
                    <div className="flex gap-2">
                      {member.days.map((day) => {
                        const bg = day.status ? HEATMAP_STATUS_COLORS[day.status] || 'bg-muted' : 'bg-muted'
                        const label = day.status ? HEATMAP_STATUS_LABELS[day.status] : 'Aucune donnée'
                        const d = new Date(day.date + 'T00:00:00')
                        const dateFormatted = format(d, 'EEEE d MMMM yyyy', { locale: fr })
                        return (
                          <Tooltip key={day.date}>
                            <TooltipTrigger asChild>
                              <div
                                className={`h-8 w-8 rounded-sm transition-colors cursor-default ${bg} ${!day.status ? 'opacity-40' : ''}`}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-semibold">{member.firstName} {member.lastName}</p>
                              <p className="text-muted-foreground capitalize">{dateFormatted}</p>
                              <p className={day.status === 'present' ? 'text-green-600' : day.status === 'absent' ? 'text-red-600' : day.status === 'late' ? 'text-amber-600' : ''}>
                                {label}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                {heatmapData.members.length} membre(s) avec données cette semaine
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/* ─── Main Attendance Page ─── */
export function AttendancePage() {
  const auth = useAppStore((s) => s.auth)

  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<ChurchEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [selectedDate, setSelectedDate] = useState(getTodayISO)
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Heatmap view state
  const [viewMode, setViewMode] = useState<'list' | 'heatmap'>('list')
  const [weekOffset, setWeekOffset] = useState(0)

  const authHeaders = {
    Authorization: `Bearer ${auth.token}`,
  }

  // Fetch active members
  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/members?status=active&limit=200', {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMembers(data.members || [])
    } catch {
      toast.error('Erreur lors du chargement des membres')
    }
  }, [auth.token])

  // Fetch events for the selector
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?limit=100', {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const list: ChurchEvent[] = data.events || []
      setEvents(list)
      if (list.length > 0 && !selectedEvent) {
        setSelectedEvent(list[0].id)
      }
    } catch {
      toast.error('Erreur lors du chargement des événements')
    }
  }, [auth.token, selectedEvent])

  // Load initial data
  useEffect(() => {
    if (!auth.token) return
    async function init() {
      setLoading(true)
      setDataReady(false)
      await Promise.all([fetchMembers(), fetchEvents()])
      setLoading(false)
    }
    init()
  }, [auth.token, fetchMembers, fetchEvents])

  // Fetch existing attendance when event+date changes, or when members load
  const fetchExistingAttendance = useCallback(async () => {
    if (!selectedEvent || !selectedDate || members.length === 0) return
    try {
      const params = new URLSearchParams({
        eventId: selectedEvent,
        date: selectedDate,
        limit: '200',
      })
      const res = await fetch(`/api/attendance?${params.toString()}`, {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const existing: Record<string, AttendanceStatus> = {}
      for (const r of data.records || []) {
        existing[r.memberId] = r.status as AttendanceStatus
      }
      // Initialize all members: use existing status or default to 'present'
      const map: Record<string, AttendanceStatus> = {}
      for (const m of members) {
        map[m.id] = existing[m.id] || 'present'
      }
      setAttendance(map)
      setDataReady(true)
    } catch {
      // Initialize all as present on error
      const map: Record<string, AttendanceStatus> = {}
      for (const m of members) {
        map[m.id] = 'present'
      }
      setAttendance(map)
      setDataReady(true)
    }
  }, [selectedEvent, selectedDate, members, auth.token])

  useEffect(() => {
    if (members.length > 0 && selectedEvent) {
      fetchExistingAttendance()
    }
  }, [members, selectedEvent, selectedDate, fetchExistingAttendance])

  function updateAttendance(memberId: string, status: AttendanceStatus) {
    setAttendance((prev) => ({ ...prev, [memberId]: status }))
  }

  function markAllPresent() {
    const updated: Record<string, AttendanceStatus> = {}
    for (const m of members) {
      updated[m.id] = 'present'
    }
    setAttendance(updated)
    toast.success('Tous les membres marqués présents')
  }

  // Filtered members based on search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members
    const q = searchQuery.toLowerCase()
    return members.filter(
      (m) =>
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q),
    )
  }, [members, searchQuery])

  // Statistics
  const stats = useMemo(() => {
    let present = 0
    let absent = 0
    let late = 0
    for (const id of Object.keys(attendance)) {
      const status = attendance[id]
      if (status === 'present') present++
      else if (status === 'absent') absent++
      else if (status === 'late') late++
    }
    const total = present + absent + late
    return { present, absent, late, total }
  }, [attendance])

  const attendanceRate =
    stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0

  // Date navigation
  const currentDateObj = new Date(selectedDate + 'T00:00:00')
  const dateDisplayLabel = isToday(currentDateObj)
    ? "Aujourd'hui"
    : format(currentDateObj, 'EEEE d MMMM yyyy', { locale: fr })

  function navigateDate(direction: 1 | -1) {
    const base = new Date(selectedDate + 'T00:00:00')
    const next = direction === 1 ? addDays(base, 1) : subDays(base, 1)
    setSelectedDate(format(next, 'yyyy-MM-dd'))
  }

  async function handleSave() {
    if (!selectedEvent) {
      toast.error('Veuillez sélectionner un événement')
      return
    }
    if (stats.total === 0) {
      toast.error('Aucun membre à enregistrer')
      return
    }

    setSaving(true)
    try {
      // Build array payload matching API schema
      const records = Object.entries(attendance).map(([memberId, status]) => ({
        memberId,
        eventId: selectedEvent,
        status,
        date: selectedDate,
      }))

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(records),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de l\'enregistrement')
      }

      const result = await res.json()
      toast.success(
        `Présences enregistrées : ${result.count} enregistrement(s) mis à jour`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suivi des Présences</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enregistrez et suivez la participation aux événements
          </p>
        </div>
        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setViewMode('list')}
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Vue quotidienne</span>
          </Button>
          <Button
            variant={viewMode === 'heatmap' ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setViewMode('heatmap')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Vue heatmap</span>
          </Button>
        </div>
      </div>

      {/* Heatmap View */}
      {viewMode === 'heatmap' ? (
        <HeatmapView weekOffset={weekOffset} onWeekChange={setWeekOffset} />
      ) : (
        <>
          {/* Selectors */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="attendance-event">Événement</Label>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger id="attendance-event">
                  <SelectValue placeholder="Choisir un événement" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.title}{' '}
                      <span className="text-muted-foreground text-xs">
                        ({new Date(ev.startDate).toLocaleDateString('fr-FR')})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:w-[280px] space-y-1.5">
              <Label>Date</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => navigateDate(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => navigateDate(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground capitalize">{dateDisplayLabel}</p>
            </div>
          </div>

          {/* Members List with Attendance Radios */}
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Liste des membres
                  {dataReady && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {stats.total} membres
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 w-fit"
                  onClick={markAllPresent}
                  disabled={!dataReady || stats.total === 0}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Tout marquer présent
                </Button>
              </div>

              {/* Search bar */}
              {dataReady && stats.total > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un membre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-36" />
                      </div>
                      <Skeleton className="h-9 w-52 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : !dataReady ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <ClipboardCheck className="h-8 w-8 opacity-30" />
                  </div>
                  <p className="text-sm font-medium">
                    {selectedEvent
                      ? 'Chargement des présences...'
                      : 'Sélectionnez un événement pour commencer'}
                  </p>
                  {!selectedEvent && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Choisissez un événement dans le menu déroulant ci-dessus
                    </p>
                  )}
                </div>
              ) : stats.total === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Aucun membre actif trouvé"
                  description="Ajoutez des membres actifs pour commencer le suivi"
                />
              ) : (
                <>
                  {/* Column headers */}
                  <div className="hidden sm:grid grid-cols-[1fr_200px] gap-2 items-center px-3 py-2 text-xs font-medium text-muted-foreground border-b mb-1">
                    <span>Membre</span>
                    <div className="flex justify-center gap-6">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        Présent
                      </span>
                      <span className="flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                        Absent
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        Retard
                      </span>
                    </div>
                  </div>

                  {/* Member rows with alternating backgrounds */}
                  <div className="max-h-[480px] overflow-y-auto space-y-0.5">
                    {filteredMembers.map((member, memberIndex) => {
                      const status = attendance[member.id] || 'present'
                      return (
                        <div
                          key={member.id}
                          className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_200px] gap-2 items-center px-3 py-2.5 rounded-lg border-l-4 transition-all duration-150 ${STATUS_BORDER_COLORS[status]} ${STATUS_BG_COLORS[status]} ${memberIndex % 2 === 0 ? '' : 'bg-muted/20'}`}
                        >
                          {/* Member info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="text-xs font-medium">
                                {getInitials(member.firstName, member.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium truncate">
                              {member.firstName} {member.lastName}
                            </span>
                          </div>

                          {/* Radio group */}
                          <RadioGroup
                            value={status}
                            onValueChange={(v) =>
                              updateAttendance(member.id, v as AttendanceStatus)
                            }
                            className="flex items-center gap-1 sm:gap-4"
                          >
                            {/* Present */}
                            <label className="flex items-center gap-1 cursor-pointer">
                              <RadioGroupItem value="present" className="sr-only peer" />
                              <span
                                className={`flex items-center justify-center h-8 w-8 rounded-full border-2 transition-all ${
                                  status === 'present'
                                    ? 'bg-green-600 border-green-600 text-white'
                                    : 'border-muted-foreground/25 hover:border-green-400'
                                }`}
                                onClick={() => updateAttendance(member.id, 'present')}
                              >
                                {status === 'present' && (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </span>
                              <span className="sm:hidden text-xs text-muted-foreground">
                                P
                              </span>
                            </label>

                            {/* Absent */}
                            <label className="flex items-center gap-1 cursor-pointer">
                              <RadioGroupItem value="absent" className="sr-only peer" />
                              <span
                                className={`flex items-center justify-center h-8 w-8 rounded-full border-2 transition-all ${
                                  status === 'absent'
                                    ? 'bg-red-600 border-red-600 text-white'
                                    : 'border-muted-foreground/25 hover:border-red-400'
                                }`}
                                onClick={() => updateAttendance(member.id, 'absent')}
                              >
                                {status === 'absent' && (
                                  <XCircle className="h-4 w-4" />
                                )}
                              </span>
                              <span className="sm:hidden text-xs text-muted-foreground">
                                A
                              </span>
                            </label>

                            {/* Late */}
                            <label className="flex items-center gap-1 cursor-pointer">
                              <RadioGroupItem value="late" className="sr-only peer" />
                              <span
                                className={`flex items-center justify-center h-8 w-8 rounded-full border-2 transition-all ${
                                  status === 'late'
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'border-muted-foreground/25 hover:border-amber-400'
                                }`}
                                onClick={() => updateAttendance(member.id, 'late')}
                              >
                                {status === 'late' && (
                                  <Clock className="h-4 w-4" />
                                )}
                              </span>
                              <span className="sm:hidden text-xs text-muted-foreground">
                                R
                              </span>
                            </label>
                          </RadioGroup>
                        </div>
                      )
                    })}
                    {filteredMembers.length === 0 && searchQuery && (
                      <div className="flex flex-col items-center py-8 text-muted-foreground">
                        <Search className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">Aucun membre trouvé pour &quot;{searchQuery}&quot;</p>
                      </div>
                    )}
                  </div>

                  {/* Save button */}
                  {canCreateAttendance(auth.role) && (
                    <div className="flex justify-end mt-4 pt-4 border-t">
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-2 min-w-[180px]"
                      >
                        {saving ? (
                          <>
                            <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Enregistrement...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Enregistrer les présences
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}

            </CardContent>
          </Card>

          {/* Statistics Section (bottom) - with animated progress circles */}
          {dataReady && stats.total > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Statistiques du jour
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Present */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <AnimatedCircularProgress
                        value={stats.total > 0 ? (stats.present / stats.total) * 100 : 0}
                        color="#16a34a"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-green-100 dark:bg-green-950">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <span className="text-sm font-medium">Présents</span>
                        </div>
                        <p className="text-3xl font-bold text-green-600 leading-none">
                          {stats.present}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.total > 0
                            ? `${Math.round((stats.present / stats.total) * 100)}% du total`
                            : '0% du total'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Absent */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <AnimatedCircularProgress
                        value={stats.total > 0 ? (stats.absent / stats.total) * 100 : 0}
                        color="#dc2626"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-red-100 dark:bg-red-950">
                            <XCircle className="h-3.5 w-3.5 text-red-600" />
                          </div>
                          <span className="text-sm font-medium">Absents</span>
                        </div>
                        <p className="text-3xl font-bold text-red-600 leading-none">
                          {stats.absent}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.total > 0
                            ? `${Math.round((stats.absent / stats.total) * 100)}% du total`
                            : '0% du total'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Late */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <AnimatedCircularProgress
                        value={stats.total > 0 ? (stats.late / stats.total) * 100 : 0}
                        color="#f59e0b"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-950">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                          <span className="text-sm font-medium">Retards</span>
                        </div>
                        <p className="text-3xl font-bold text-amber-600 leading-none">
                          {stats.late}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.total > 0
                            ? `${Math.round((stats.late / stats.total) * 100)}% du total`
                            : '0% du total'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Attendance rate */}
              <Card className="mt-4">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <AnimatedCircularProgress
                      value={attendanceRate}
                      color="hsl(var(--primary))"
                      size={64}
                      strokeWidth={6}
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Taux de participation</span>
                      </div>
                      <p className="text-3xl font-bold leading-none">{attendanceRate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.present + stats.late} présent(s) sur {stats.total} membres
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
    </TooltipProvider>
  )
}