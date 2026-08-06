'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Users, CalendarDays, Receipt, ArrowRight, Command } from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app-store'
import type { AppView } from '@/lib/constants'

interface SearchResult {
  id: string
  name: string
  detail: string
  view: AppView
}

interface SearchGroup {
  heading: string
  icon: React.ReactNode
  results: SearchResult[]
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [value, delay])

  return debouncedValue
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<SearchGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const token = useAppStore((s) => s.auth.token)
  const setCurrentView = useAppStore((s) => s.setCurrentView)

  const debouncedQuery = useDebounce(query, 300)

  // Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset state when dialog closes via handler (not effect)
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        setQuery('')
        setGroups([])
        setIsLoading(false)
        setHasSearched(false)
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
          abortControllerRef.current = null
        }
      }
    },
    []
  )

  // Search when debounced query changes — only when there is actual query text
  useEffect(() => {
    if (!open || !debouncedQuery.trim() || !token) return

    const searchEndpoint = async (
      url: string,
      heading: string,
      icon: React.ReactNode,
      view: AppView,
      mapFn: (item: Record<string, unknown>) => SearchResult
    ) => {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortControllerRef.current?.signal,
        })
        if (!res.ok) return { heading, icon, results: [] }
        const data = await res.json()
        const items = Array.isArray(data) ? data : data.data ?? []
        return {
          heading,
          icon,
          results: items.map(mapFn),
        }
      } catch {
        if (abortControllerRef.current?.signal.aborted) return null
        return { heading, icon, results: [] }
      }
    }

    const performSearch = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()
      setIsLoading(true)

      const q = encodeURIComponent(debouncedQuery.trim())
      const queryParams = `search=${q}&limit=5`

      const [membersGroup, eventsGroup, financesGroup] = await Promise.all([
        searchEndpoint(
          `/api/members?${queryParams}`,
          'Membres',
          <Users className="size-4 text-amber-600" />,
          'members',
          (item) => ({
            id: String(item.id),
            name: String(item.firstName ?? '') + ' ' + String(item.lastName ?? ''),
            detail: String(item.email ?? String(item.phone ?? '')),
            view: 'members' as AppView,
          })
        ),
        searchEndpoint(
          `/api/events?${queryParams}`,
          'Événements',
          <CalendarDays className="size-4 text-emerald-600" />,
          'events',
          (item) => ({
            id: String(item.id),
            name: String(item.title ?? ''),
            detail: String(item.type ?? '') + ' · ' + String(item.date ?? ''),
            view: 'events' as AppView,
          })
        ),
        searchEndpoint(
          `/api/finances?${queryParams}`,
          'Transactions',
          <Receipt className="size-4 text-rose-600" />,
          'finances',
          (item) => ({
            id: String(item.id),
            name: String(item.description ?? ''),
            detail: `${item.type === 'revenue' ? '↗' : '↘'} ${String(item.amount ?? '0')} ${String(item.currency ?? '')}`,
            view: 'finances' as AppView,
          })
        ),
      ])

      if (!abortControllerRef.current?.signal.aborted) {
        const validGroups = [membersGroup, eventsGroup, financesGroup].filter(
          (g): g is SearchGroup => g !== null
        )
        setGroups(validGroups)
        setIsLoading(false)
        setHasSearched(true)
      }
    }

    performSearch()
  }, [debouncedQuery, open, token])

  const handleSelect = useCallback(
    (view: AppView) => {
      handleOpenChange(false)
      setCurrentView(view)
    },
    [setCurrentView, handleOpenChange]
  )

  const totalResults = groups.reduce((sum, g) => sum + g.results.length, 0)
  const isSearching = open && debouncedQuery.trim().length > 0

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <div className="flex flex-col">
        <CommandInput
          placeholder="Rechercher des membres, événements, transactions..."
          value={query}
          onValueChange={setQuery}
        />

        {isLoading && (
          <div className="space-y-2 px-3 py-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <CommandList className="max-h-[360px]">
            {hasSearched && totalResults === 0 && (
              <CommandEmpty>
                Aucun résultat trouvé pour &quot;{debouncedQuery}&quot;
              </CommandEmpty>
            )}

            {groups.map(
              (group, groupIndex) =>
                group.results.length > 0 && (
                  <div key={group.heading}>
                    {groupIndex > 0 && <CommandSeparator />}
                    <CommandGroup heading={group.heading}>
                      {group.results.map((result) => (
                        <CommandItem
                          key={`${group.heading}-${result.id}`}
                          value={`${result.name} ${result.detail}`}
                          onSelect={() => handleSelect(result.view)}
                          className="flex items-center gap-3 cursor-pointer py-2.5"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                            {group.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {result.detail}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {group.heading}
                            </Badge>
                            <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-data-[selected=true]/command-item:opacity-100 transition-opacity" />
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </div>
                )
            )}
          </CommandList>
        )}

        {/* Footer with keyboard shortcut hints */}
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                <Command className="size-2.5" />
                K
              </kbd>
              <span>Ouvrir</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                ↵
              </kbd>
              <span>Sélectionner</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                esc
              </kbd>
              <span>Fermer</span>
            </span>
          </div>
          {isSearching && totalResults > 0 && !isLoading && (
            <span>
              {totalResults} résultat{totalResults > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </CommandDialog>
  )
}