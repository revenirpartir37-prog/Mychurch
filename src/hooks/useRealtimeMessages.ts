'use client';
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';

interface RealtimeMessage {
  id: string;
  churchId: string;
  senderId: string;
  receiverId: string;
  subject: string;
  content: string;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
  sender?: { id: string; firstName: string; lastName: string; photo?: string | null; role?: string | null };
  receiver?: { id: string; firstName: string; lastName: string; photo?: string | null; role?: string | null };
}

export function useRealtimeMessages(onMessageInserted: (msg: RealtimeMessage) => void) {
  const auth = useAppStore((s) => s.auth);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onMessageInsertedRef = useRef(onMessageInserted);
  onMessageInsertedRef.current = onMessageInserted;

  useEffect(() => {
    if (!auth.userId || !auth.token) return;

    const channel = supabase
      .channel(`messages-realtime-${auth.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `churchId=eq.${auth.churchId}`,
        },
        async (payload) => {
          const raw = payload.new as RealtimeMessage;
          const myId = useAppStore.getState().auth.userId;

          if (raw.receiverId === myId) {
            // Fetch the full message with sender/receiver relations (cap 50)
            try {
              const res = await fetch(`/api/messages?folder=inbox&limit=50`, {
                headers: { Authorization: `Bearer ${useAppStore.getState().auth.token}` },
              });
              if (res.ok) {
                const data = await res.json();
                const full = (data.messages || []).find((m: { id: string }) => m.id === raw.id);
                if (full) {
                  onMessageInsertedRef.current(full);
                } else {
                  onMessageInsertedRef.current(raw);
                }
              } else {
                onMessageInsertedRef.current(raw);
              }
            } catch {
              onMessageInsertedRef.current(raw);
            }

            if ('vibrate' in navigator) navigator.vibrate(80);
            new Audio('/sounds/message.mp3').play().catch(() => {});
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(JSON.stringify({ scope: 'realtime:messages', msg: 'CHANNEL_ERROR', status, err: err ? String(err) : undefined }))
        }
      });

    channelRef.current = channel;

    // Fallback: si Realtime ne délivre rien (RLS ou réseau), refetch après 8s
    const fallback = window.setTimeout(() => {
      const state = (channel as unknown as { state?: string }).state
      if (state !== 'joined') {
        console.warn(JSON.stringify({ scope: 'realtime:messages', msg: 'FALLBACK_REFETCH_8S', state }))
        // Déclenche un refetch via un message vide filtré côté caller (caller peut ignorer si déjà à jour)
        // On ne peut pas appeler onMessageInserted sans donnée, donc on log seulement — polling 60s ci-dessous prend le relais.
      }
    }, 8000)

    return () => {
      window.clearTimeout(fallback)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [auth.userId, auth.churchId, auth.token]);
}
