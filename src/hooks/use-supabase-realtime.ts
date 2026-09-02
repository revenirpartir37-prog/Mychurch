import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

let channelCounter = 0
const uniqueId = () => `realtime-${++channelCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function normalizeTableName(name: string): string {
  return name.trim().toLowerCase()
}

const MIN_INTERVAL_MS = 5000

export function useSupabaseRealtime(
  tables: string[],
  onChange: () => void,
  filterChurchId?: string | null
) {
  const onChangeRef = useRef(onChange)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const lastFireRef = useRef(0)
  const pendingRef = useRef(false)
  onChangeRef.current = onChange
  const normalizedTables = tables.map(normalizeTableName)

  const throttledFire = useRef(() => {
    const now = Date.now()
    const elapsed = now - lastFireRef.current
    if (elapsed >= MIN_INTERVAL_MS) {
      lastFireRef.current = now
      onChangeRef.current()
    } else if (!pendingRef.current) {
      pendingRef.current = true
      setTimeout(() => {
        pendingRef.current = false
        lastFireRef.current = Date.now()
        onChangeRef.current()
      }, MIN_INTERVAL_MS - elapsed)
    }
  }).current

  useEffect(() => {
    if (!tables.length || !supabase) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    const channel = supabase
      .channel(uniqueId())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const table = normalizeTableName(payload.table as string)
          const rec = (payload.new ?? (payload as any).old) as { churchId?: string } | null
          if (normalizedTables.includes(table)) {
            if (filterChurchId && rec?.churchId && rec.churchId !== filterChurchId) return
            throttledFire()
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(JSON.stringify({ scope: 'realtime', msg: 'CHANNEL_ERROR', status, err: err ? String(err) : undefined, tables: normalizedTables }))
          throttledFire()
        }
      })
    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [JSON.stringify(normalizedTables), filterChurchId])
}
