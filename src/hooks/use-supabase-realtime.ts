import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Nom de canal GARANTI UNIQUE pour chaque instance de hook.
// supabase-js dédoublonne les canaux par nom : si deux composants abonnent le même nom,
// le 2e `.on()` après un `.subscribe()` déjà fait lève
// "cannot add postgres_changes callbacks ... after subscribe()".
let channelCounter = 0
const uniqueId = () => `realtime-${++channelCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function normalizeTableName(name: string): string {
  return name.trim().toLowerCase()
}

// Tables activées sur la publication Realtime.
// Se déclenche sur INSERT/UPDATE/DELETE et appelle `onChange` (rafraîchit les données).
export function useSupabaseRealtime(
  tables: string[],
  onChange: () => void,
  filterChurchId?: string | null
) {
  const onChangeRef = useRef(onChange)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  onChangeRef.current = onChange
  const normalizedTables = tables.map(normalizeTableName)

  useEffect(() => {
    if (!tables.length || !supabase) return

    // Recrée le canal si filterChurchId/tables change — évite closure stale (lot8)
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
            onChangeRef.current()
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(JSON.stringify({ scope: 'realtime', msg: 'CHANNEL_ERROR', status, err: err ? String(err) : undefined, tables: normalizedTables }))
          onChangeRef.current()
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
