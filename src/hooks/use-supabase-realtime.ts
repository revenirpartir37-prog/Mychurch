import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Nom de canal GARANTI UNIQUE pour chaque instance de hook.
// supabase-js dédoublonne les canaux par nom : si deux composants abonnent le même nom,
// le 2e `.on()` après un `.subscribe()` déjà fait lève
// "cannot add postgres_changes callbacks ... after subscribe()".
let channelCounter = 0
const uniqueId = () => `realtime-${++channelCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

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

  useEffect(() => {
    if (!tables.length || !supabase) return

    // On ne construit le canal qu'une seule fois par instance (fm de life).
    if (!channelRef.current) {
      channelRef.current = supabase
        .channel(uniqueId())
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
    }

    return () => {
      // On laisse chaque composant nettoyer son propre canal à son démontage.
      const channel = channelRef.current
      channelRef.current = null
      if (channel) supabase.removeChannel(channel)
    }
  }, [JSON.stringify(tables), filterChurchId])
}
