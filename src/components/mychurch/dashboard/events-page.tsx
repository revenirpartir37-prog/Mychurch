'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAppStore } from '@/store/app-store'
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime'
import { EVENT_LABELS, type EventType } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  CalendarDays,
  MapPin,
  Clock,
  Edit,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  CalendarRange,
  CalendarClock,
  ChevronDown,
  Filter,
  Eye,
} from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
  getHours,
  getMinutes,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { EmptyState } from '@/components/mychurch/shared/empty-state'
import { canCreateEvents, canEditEvents, canDeleteEvents } from '@/lib/frontend-rbac'

interface ChurchEvent {
  id: string
  title: string
  description: string | null
  type: string
  startDate: string
  endDate: string | null
  location: string | null
  _count: { attendance: number }
  createdAt: string
}

interface EventForm {
  title: string
  description: string
  type: EventType
  startDate: string
  endDate: string
  location: string
}

const emptyForm: EventForm = {
  title: '',
  description: '',
  type: 'culte',
  startDate: '',
  endDate: '',
  location: '',
}

// Color maps: culte=teal, reunion=amber, seminar=orange, conference=rose, formation=emerald
const TYPE_COLORS: Record<string, string> = {
  culte: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  reunion: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  seminar: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  conference: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  formation: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
}

const TYPE_BORDER_COLORS: Record<string, string> = {
  culte: 'border-l-teal-500',
  reunion: 'border-l-amber-500',
  seminar: 'border-l-orange-500',
  conference: 'border-l-rose-500',
  formation: 'border-l-emerald-500',
}

const TYPE_DOT_COLORS: Record<string, string> = {
  culte: 'bg-teal-500',
  reunion: 'bg-amber-500',
  seminar: 'bg-orange-500',
  conference: 'bg-rose-500',
  formation: 'bg-emerald-500',
}

const TYPE_HOVER_GRADIENTS: Record<string, string> = {
  culte: 'hover:bg-gradient-to-r hover:from-teal-50/80 hover:to-transparent dark:hover:from-teal-950/30',
  reunion: 'hover:bg-gradient-to-r hover:from-amber-50/80 hover:to-transparent dark:hover:from-amber-950/30',
  seminar: 'hover:bg-gradient-to-r hover:from-orange-50/80 hover:to-transparent dark:hover:from-orange-950/30',
  conference: 'hover:bg-gradient-to-r hover:from-rose-50/80 hover:to-transparent dark:hover:from-rose-950/30',
  formation: 'hover:bg-gradient-to-r hover:from-emerald-50/80 hover:to-transparent dark:hover:from-emerald-950/30',
}

const TYPE_PILL_BG: Record<string, string> = {
  culte: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
  reunion: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
  seminar: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
  conference: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
  formation: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
}

const TYPE_PILL_TEXT: Record<string, string> = {
  culte: 'text-teal-700 dark:text-teal-300',
  reunion: 'text-amber-700 dark:text-amber-300',
  seminar: 'text-orange-700 dark:text-orange-300',
  conference: 'text-rose-700 dark:text-rose-300',
  formation: 'text-emerald-700 dark:text-emerald-300',
}

const TYPE_DIALOG_BORDER: Record<string, string> = {
  culte: 'border-l-teal-500',
  reunion: 'border-l-amber-500',
  seminar: 'border-l-orange-500',
  conference: 'border-l-rose-500',
  formation: 'border-l-emerald-500',
}

// Date badge background colors
const TYPE_DATE_BG: Record<string, string> = {
  culte: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  reunion: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  seminar: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  conference: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  formation: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
}

// Filter pill styling
const TYPE_PILL_ACTIVE: Record<string, string> = {
  culte: 'bg-teal-500 text-white border-teal-500',
  reunion: 'bg-amber-500 text-white border-amber-500',
  seminar: 'bg-orange-500 text-white border-orange-500',
  conference: 'bg-rose-500 text-white border-rose-500',
  formation: 'bg-emerald-500 text-white border-emerald-500',
}

const TYPE_PILL_INACTIVE: Record<string, string> = {
  culte: 'text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30',
  reunion: 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30',
  seminar: 'text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30',
  conference: 'text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30',
  formation: 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
}

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const WEEK_DAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

function formatFrenchDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateRange(start: string, end: string | null): string {
  const formatted = formatFrenchDate(start)
  if (!end) return formatted
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (startDate.toDateString() === endDate.toDateString()) {
    return `${formatFrenchDate(start)} — ${new Date(end).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }
  return `${formatted} → ${formatFrenchDate(end)}`
}

/* ─── Mini Calendar Component ─── */
function MiniCalendar({ events }: { events: ChurchEvent[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Build a map of day string -> event types
  const eventsByDay = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const ev of events) {
      const dayKey = format(new Date(ev.startDate), 'yyyy-MM-dd')
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(ev.type)
    }
    return map
  }, [events])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendrier
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEK_DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-medium text-muted-foreground py-1"
            >
              {d}
            </div>
          ))}
        </div>
        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDay[dayKey] || []
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const today = isToday(day)

            return (
              <div
                key={dayKey}
                className={`flex flex-col items-center justify-start min-h-[40px] rounded-md py-1 px-0.5 transition-colors ${
                  !isCurrentMonth
                    ? 'opacity-30'
                    : today
                      ? 'bg-primary/10 ring-1 ring-primary/30'
                      : 'hover:bg-muted/50'
                }`}
              >
                <span
                  className={`text-xs leading-none ${
                    today
                      ? 'font-bold text-primary'
                      : isCurrentMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {/* Colored dots */}
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                    {dayEvents.slice(0, 3).map((type, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT_COLORS[type] || 'bg-primary'}`}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[8px] text-muted-foreground leading-none">
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Full Month Calendar Component ─── */
function FullMonthCalendar({
  events,
  calendarMonth,
  onMonthChange,
  onEventClick,
}: {
  events: ChurchEvent[]
  calendarMonth: Date
  onMonthChange: (date: Date) => void
  onEventClick: (event: ChurchEvent) => void
}) {
  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(calendarMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  // Always render 6 rows (42 days)
  const calendarEnd = new Date(calendarStart)
  calendarEnd.setDate(calendarEnd.getDate() + 41)

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const eventsByDay = useMemo(() => {
    const map: Record<string, ChurchEvent[]> = {}
    for (const ev of events) {
      const dayKey = format(new Date(ev.startDate), 'yyyy-MM-dd')
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(ev)
    }
    // Sort each day's events by start time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    }
    return map
  }, [events])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="h-4 w-4" />
            Vue calendrier
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onMonthChange(subMonths(calendarMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center capitalize">
              {format(calendarMonth, 'MMMM yyyy', { locale: fr })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onMonthChange(addMonths(calendarMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b">
          {WEEK_DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wide"
            >
              {d}
            </div>
          ))}
        </div>
        {/* Day grid */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDay[dayKey] || []
            const isCurrentMonth = isSameMonth(day, calendarMonth)
            const today = isToday(day)
            const maxVisible = 3
            const overflowCount = dayEvents.length - maxVisible

            return (
              <div
                key={dayKey}
                className={`min-h-[100px] sm:min-h-[110px] border-b border-r p-1 transition-colors ${
                  !isCurrentMonth ? 'opacity-40' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-center mb-1">
                  <span
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm ${
                      today
                        ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary/30'
                        : isCurrentMonth
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                {/* Event pills */}
                <div className="space-y-0.5">
                  {dayEvents.slice(0, maxVisible).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className={`w-full text-left text-[11px] sm:text-xs leading-tight px-1.5 py-0.5 rounded border-l-2 truncate transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                        TYPE_PILL_BG[ev.type] || 'bg-muted border-l-primary'
                      } ${TYPE_PILL_TEXT[ev.type] || 'text-foreground'}`}
                    >
                      <span className="hidden sm:inline">{ev.title}</span>
                      <span className="sm:hidden flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${TYPE_DOT_COLORS[ev.type] || 'bg-primary'}`} />
                        <span className="truncate">{ev.title}</span>
                      </span>
                    </button>
                  ))}
                  {overflowCount > 0 && (
                    <div className="text-[11px] text-muted-foreground font-medium px-1.5 py-0.5">
                      +{overflowCount} autre{overflowCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Week View Component ─── */
const HOUR_START = 8
const HOUR_END = 22
const SLOT_HEIGHT = 64 // px per hour

function WeekView({
  events,
  weekStart,
  onWeekChange,
  onEventClick,
}: {
  events: ChurchEvent[]
  weekStart: Date
  onWeekChange: (date: Date) => void
  onEventClick: (event: ChurchEvent) => void
}) {
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map: Record<string, ChurchEvent[]> = {}
    for (const ev of events) {
      const evStart = parseISO(ev.startDate)
      const dayKey = format(evStart, 'yyyy-MM-dd')
      if (weekDays.some((wd) => format(wd, 'yyyy-MM-dd') === dayKey)) {
        if (!map[dayKey]) map[dayKey] = []
        map[dayKey].push(ev)
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    }
    return map
  }, [events, weekDays])

  const timeSlots = useMemo(() => {
    return Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
  }, [])

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const weekLabel = `${format(weekStart, 'd', { locale: fr })} — ${format(weekEnd, 'd MMMM yyyy', { locale: fr })}`

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Vue semaine
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onWeekChange(subWeeks(weekStart, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">
              {weekLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onWeekChange(addWeeks(weekStart, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Day headers */}
          <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b">
            <div className="p-2" />
            {weekDays.map((day, i) => {
              const today = isToday(day)
              return (
                <div
                  key={i}
                  className={`text-center py-2 text-xs font-semibold uppercase tracking-wide ${
                    today ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <div>{WEEK_DAYS[i]}</div>
                  <div
                    className={`mt-1 inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-bold ${
                      today ? 'bg-primary text-primary-foreground' : 'text-foreground'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[48px_repeat(7,1fr)]">
            {/* Time labels column */}
            <div className="relative">
              {timeSlots.map((hour) => (
                <div
                  key={hour}
                  className="text-[10px] text-muted-foreground text-right pr-2 -mt-2"
                  style={{ height: `${SLOT_HEIGHT}px` }}
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, dayIdx) => {
              const dayKey = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDay[dayKey] || []
              const today = isToday(day)

              return (
                <div
                  key={dayIdx}
                  className={`relative border-l ${today ? 'bg-primary/[0.02]' : ''}`}
                  style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}
                >
                  {/* Hour grid lines */}
                  {timeSlots.map((hour) => (
                    <div
                      key={hour}
                      className="border-t border-border/50 absolute left-0 right-0"
                      style={{ top: `${(hour - HOUR_START) * SLOT_HEIGHT}px` }}
                    />
                  ))}
                  {/* Half-hour lines */}
                  {timeSlots.map((hour) => (
                    <div
                      key={`half-${hour}`}
                      className="border-t border-border/20 absolute left-0 right-0"
                      style={{ top: `${(hour - HOUR_START) * SLOT_HEIGHT + SLOT_HEIGHT / 2}px` }}
                    />
                  ))}

                  {/* Event blocks */}
                  {dayEvents.map((ev) => {
                    const evStart = parseISO(ev.startDate)
                    const evEnd = ev.endDate ? parseISO(ev.endDate) : evStart
                    const startHour = getHours(evStart) + getMinutes(evStart) / 60
                    const endHour = getHours(evEnd) + getMinutes(evEnd) / 60
                    const duration = Math.max(endHour - startHour, 0.5)

                    const top = Math.max((startHour - HOUR_START) * SLOT_HEIGHT, 0)
                    const height = duration * SLOT_HEIGHT

                    // If event starts before HOUR_START, clip it
                    const clippedTop = startHour < HOUR_START ? 0 : top
                    const clippedHeight = startHour < HOUR_START
                      ? height - (HOUR_START - startHour) * SLOT_HEIGHT
                      : height

                    if (clippedTop >= timeSlots.length * SLOT_HEIGHT || clippedHeight <= 0) return null

                    return (
                      <button
                        key={ev.id}
                        onClick={() => onEventClick(ev)}
                        className={`absolute left-0.5 right-0.5 rounded-md border-l-[3px] px-1.5 py-0.5 text-left overflow-hidden transition-all hover:scale-[1.02] hover:z-10 hover:shadow-md active:scale-[0.98] ${
                          TYPE_PILL_BG[ev.type] || 'bg-muted'
                        }`}
                        style={{
                          top: `${clippedTop}px`,
                          height: `${Math.min(clippedHeight, timeSlots.length * SLOT_HEIGHT - clippedTop)}px`,
                        }}
                      >
                        <div className={`text-[11px] font-semibold leading-tight truncate ${TYPE_PILL_TEXT[ev.type] || ''}`}>
                          {ev.title}
                        </div>
                        {clippedHeight >= 30 && (
                          <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                            {format(evStart, 'HH:mm')}{ev.endDate && ` – ${format(evEnd, 'HH:mm')}`}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Event Detail Dialog ─── */
function EventDetailDialog({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  event: ChurchEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (event: ChurchEvent) => void
  onDelete: (event: ChurchEvent) => void
}) {
  if (!event) return null

  const borderColor = TYPE_DIALOG_BORDER[event.type] || 'border-l-primary'
  const colorClass = TYPE_COLORS[event.type] || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-md border-l-4 ${borderColor}`}>
        <DialogHeader>
          <DialogTitle className="text-lg leading-tight">{event.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Event type badge */}
          <div>
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-0.5 border-0 ${colorClass}`}
            >
              {EVENT_LABELS[event.type as EventType] || event.type}
            </Badge>
          </div>

          {/* Date/time */}
          <div className="flex items-start gap-2.5 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">{formatFrenchDate(event.startDate)}</div>
              {event.endDate && !isSameDay(parseISO(event.startDate), parseISO(event.endDate)) && (
                <div className="text-muted-foreground mt-0.5">
                  jusqu&apos;au {formatFrenchDate(event.endDate)}
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-2.5 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="text-sm text-muted-foreground leading-relaxed bg-muted/50 rounded-lg p-3">
              {event.description}
            </div>
          )}

          {/* Attendees */}
          <div className="flex items-center gap-2.5 text-sm">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>
              {event._count.attendance} participant{event._count.attendance !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => {
              onDelete(event)
              onOpenChange(false)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              onEdit(event)
              onOpenChange(false)
            }}
          >
            <Edit className="h-3.5 w-3.5" />
            Modifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Event Card with expandable details ─── */
function EventCard({
  event,
  onEdit,
  onDelete,
}: {
  event: ChurchEvent
  onEdit: (event: ChurchEvent) => void
  onDelete: (event: ChurchEvent) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const auth = useAppStore((s) => s.auth)
  const isEventToday = isSameDay(new Date(event.startDate), new Date())
  const borderColor = TYPE_BORDER_COLORS[event.type] || 'border-l-primary'
  const hoverGradient = TYPE_HOVER_GRADIENTS[event.type] || 'hover:bg-muted/30'
  const dateBg = TYPE_DATE_BG[event.type] || 'bg-muted text-foreground'
  const eventDate = new Date(event.startDate)

  return (
    <Card
      className={`border-l-4 ${borderColor} ${hoverGradient} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden relative`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />

      <CardHeader className="pb-3 relative">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight line-clamp-2 flex-1">
            {event.title}
          </CardTitle>
          {/* Date badge - top right */}
          <div className={`flex flex-col items-center justify-center h-12 w-11 rounded-lg shrink-0 ${dateBg}`}>
            <span className="text-lg font-bold leading-tight">
              {eventDate.getDate()}
            </span>
            <span className="text-[9px] font-medium uppercase leading-none">
              {format(eventDate, 'MMM', { locale: fr })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {isEventToday && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 border-0">
              Aujourd&apos;hui
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`text-[11px] px-2 py-0.5 border-0 ${TYPE_COLORS[event.type] || ''}`}
          >
            {EVENT_LABELS[event.type as EventType] || event.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 relative">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">
            {formatDateRange(event.startDate, event.endDate)}
          </span>
        </div>

        {event.location && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {/* Expandable description */}
        {event.description && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Voir détails</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-2 bg-muted/50 rounded-lg p-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                {event.description}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 mt-auto pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            <span>{event._count.attendance} participant{event._count.attendance !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t">
          {canEditEvents(auth.role) && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => onEdit(event)}
            >
              <Edit className="h-3.5 w-3.5" />
              Modifier
            </Button>
          )}
          {canDeleteEvents(auth.role) && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive"
              onClick={() => onDelete(event)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function EventsPage() {
  const auth = useAppStore((s) => s.auth)

  const [events, setEvents] = useState<ChurchEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [pillFilter, setPillFilter] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'calendar' | 'week'>('grid')
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedEvent, setSelectedEvent] = useState<ChurchEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.token}`,
  }

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (pillFilter) params.set('type', pillFilter)
      const res = await fetch(`/api/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(data.events || [])
    } catch {
      toast.error('Erreur lors du chargement des événements')
    } finally {
      setLoading(false)
    }
  }, [pillFilter, auth.token])

  useSupabaseRealtime(['event'], () => fetchEvents(), auth.churchId)
  useEffect(() => {
    if (auth.token) fetchEvents()
  }, [fetchEvents, auth.token])

  function openCreateDialog() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(event: ChurchEvent) {
    setEditingId(event.id)
    setForm({
      title: event.title,
      description: event.description || '',
      type: event.type as EventType,
      startDate: new Date(event.startDate).toISOString().slice(0, 16),
      endDate: event.endDate
        ? new Date(event.endDate).toISOString().slice(0, 16)
        : '',
      location: event.location || '',
    })
    setDialogOpen(true)
  }

  function openDetailDialog(event: ChurchEvent) {
    setSelectedEvent(event)
    setDetailOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Le titre est requis')
      return
    }
    if (!form.startDate) {
      toast.error('La date de début est requise')
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        // Update
        const body: Record<string, unknown> = { id: editingId }
        if (form.title) body.title = form.title
        if (form.description !== undefined) body.description = form.description || null
        if (form.type) body.type = form.type
        if (form.startDate) body.startDate = form.startDate
        body.endDate = form.endDate || null
        if (form.location !== undefined) body.location = form.location || null

        const res = await fetch(`/api/events?id=${editingId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erreur de mise à jour')
        }
        toast.success('Événement mis à jour avec succès')
      } else {
        // Create
        const res = await fetch('/api/events', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: form.title,
            description: form.description || undefined,
            type: form.type,
            startDate: form.startDate,
            endDate: form.endDate || undefined,
            location: form.location || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erreur de création')
        }
        toast.success('Événement créé avec succès')
      }
      setDialogOpen(false)
      fetchEvents()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(event: ChurchEvent) {
    if (!confirm(`Supprimer l'événement "${event.title}" ?`)) return
    try {
      const res = await fetch(`/api/events?id=${event.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (!res.ok) throw new Error()
      toast.success('Événement supprimé')
      fetchEvents()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  function updateForm(field: keyof EventForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Filter pills data
  const filterPills = [
    { key: '', label: 'Tous' },
    { key: 'culte', label: 'Cultes' },
    { key: 'reunion', label: 'Réunions' },
    { key: 'seminar', label: 'Séminaires' },
    { key: 'conference', label: 'Conférences' },
    { key: 'formation', label: 'Formations' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Événements</h1>
              {!loading && events.length > 0 && (
                <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold">
                  {events.length}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Planifiez et gérez les événements de votre église
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          {!loading && events.length > 0 && (
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vue grille</span>
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setViewMode('calendar')}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vue calendrier</span>
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setViewMode('week')}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vue semaine</span>
              </Button>
            </div>
          )}
          {canCreateEvents(auth.role) && (
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nouvel événement</span>
              <span className="sm:hidden">Nouveau</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Pills Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {filterPills.map((pill) => {
          const isActive = pillFilter === pill.key
          const pillStyle = pill.key
            ? isActive
              ? TYPE_PILL_ACTIVE[pill.key]
              : TYPE_PILL_INACTIVE[pill.key]
            : isActive
              ? 'bg-primary text-white border-primary'
              : 'text-foreground border-border hover:bg-muted'

          return (
            <button
              key={pill.key}
              onClick={() => setPillFilter(pill.key)}
              className={`inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all duration-200 ${pillStyle}`}
            >
              {pill.label}
            </button>
          )
        })}
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && !loading && events.length > 0 && (
        <FullMonthCalendar
          events={events}
          calendarMonth={calendarMonth}
          onMonthChange={setCalendarMonth}
          onEventClick={openDetailDialog}
        />
      )}

      {/* Week View */}
      {viewMode === 'week' && !loading && events.length > 0 && (
        <WeekView
          events={events}
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          onEventClick={openDetailDialog}
        />
      )}

      {/* Grid View (default) or loading / empty states */}
      {(viewMode === 'grid' || loading || events.length === 0) && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-20 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="flex gap-2 justify-end pt-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <EmptyState
                  icon={CalendarDays}
                  title="Aucun événement planifié"
                  description="Commencez par planifier votre premier événement pour votre église"
                  action={canCreateEvents(auth.role) ? { label: 'Créer un événement', onClick: openCreateDialog } : undefined}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onEdit={openEditDialog}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Mini Calendar View (visible in grid and calendar modes) */}
      {!loading && events.length > 0 && (viewMode === 'grid' || viewMode === 'calendar') && (
        <MiniCalendar events={events} />
      )}

      {/* Event Detail Dialog */}
      <EventDetailDialog
        event={selectedEvent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEditDialog}
        onDelete={handleDelete}
      />

      {/* Add/Edit Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier l'événement" : 'Nouvel événement'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="event-title">
                Titre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="event-title"
                placeholder="Titre de l'événement"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="event-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => updateForm('type', v)}
              >
                <SelectTrigger id="event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(EVENT_LABELS) as [EventType, string][]).map(
                    ([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-start">
                  Date de début <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="event-start"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => updateForm('startDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end">Date de fin</Label>
                <Input
                  id="event-end"
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => updateForm('endDate', e.target.value)}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="event-location">Lieu</Label>
              <Input
                id="event-location"
                placeholder="Lieu de l'événement"
                value={form.location}
                onChange={(e) => updateForm('location', e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                placeholder="Description de l'événement..."
                className="min-h-[100px] resize-none"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline" disabled={submitting}>
                Annuler
              </Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? (
                <>
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : editingId ? (
                'Mettre à jour'
              ) : (
                'Créer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}