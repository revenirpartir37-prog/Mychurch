import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Nom de canal unique par instance de hook (sinon supabase-js dédoublonne par nom
// et `.on()` après un `subscribe()` déjà fait lève une erreur).
let channelCounter = 0
const uniqueId = () => `realtime-${++channelCounter}-${Math.random().toString(36).slice(2, 8)}`

// Tables activées dans la publication Realtime Supabase.
// Se déclenche sur INSERT/UPDATE/DELETE et appelle `onChange` (rafraîchit les données).
export function useSupabaseRealtime(
  tables: string[],
  onChange: () => void,
  filterChurchId?: string | null
) {
  const onChangeRef = useRef(onChange)
  const channelNameRef = useRef<string | null>(null)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!tables.length || !supabase) return

    // On garde le même nom pour ce composant tout au long de sa vie ;
    // un composant ne ré-abonne jamais _.on()_ après subscribe sur ce même canal.
    if (!channelNameRef.current) {
      channelNameRef.current = uniqueId()
    }

    const channel = supabase
      .channel(channelNameRef.current)
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
      channelNameRef.current = null
    }
  }, [JSON.stringify(tables), filterChurchId])
}
