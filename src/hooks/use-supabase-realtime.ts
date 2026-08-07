import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Tables activées dans la publication Realtime Supabase.
// Se déclenche sur INSERT/UPDATE/DELETE et appelle `onChange` (rafraîchit les données).
export function useSupabaseRealtime(
  tables: string[],
  onChange: () => void,
  filterChurchId?: string | null
) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!tables.length || !supabase) return

    const channel = supabase
      .channel('mychurch-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const table = payload.table as string
          const record = payload.new as { churchId?: string } | null
          // Ne rafraîchir que si la table nous concerne
          if (tables.includes(table)) {
            // Si un filtre par église est fourni, ignorer les autres églises
            if (filterChurchId && record?.churchId && record.churchId !== filterChurchId) {
              return
            }
            onChangeRef.current()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [JSON.stringify(tables), filterChurchId])
}
