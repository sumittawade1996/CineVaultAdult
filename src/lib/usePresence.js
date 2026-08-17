import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Uses Supabase Realtime Presence — every open tab "joins" a shared
// channel and the count of distinct joins is the live viewer count.
// No extra table or backend needed; Realtime is on by default on new
// Supabase projects (Project Settings -> API -> Realtime should show enabled).
export function useActiveUsers() {
  const [count, setCount] = useState(1)

  useEffect(() => {
    let channel
    let cancelled = false

    // This is decorative UI, not real content — don't let its WebSocket
    // connection compete with the page's actual data fetches (movies,
    // articles) for network priority during initial load. Open it once
    // the browser is idle / the critical path has had a moment to breathe.
    const start = () => {
      if (cancelled) return
      const sessionId = crypto.randomUUID?.() || Math.random().toString(36).slice(2)
      channel = supabase.channel('vxn-active-users', {
        config: { presence: { key: sessionId } },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          setCount(Math.max(1, Object.keys(state).length))
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ online_at: new Date().toISOString() })
          }
        })
    }

    const idleId =
      'requestIdleCallback' in window
        ? window.requestIdleCallback(start, { timeout: 2000 })
        : setTimeout(start, 1500)

    return () => {
      cancelled = true
      if ('requestIdleCallback' in window) window.cancelIdleCallback(idleId)
      else clearTimeout(idleId)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return count
}
