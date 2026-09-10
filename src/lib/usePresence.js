import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Uses Supabase Realtime Presence — every open tab "joins" a shared
// channel and the count of distinct joins is the live viewer count.
//
// One channel is shared by every component that shows the count (the
// navbar renders it in both the desktop bar and the mobile menu):
// supabase-js reuses a channel per topic, and adding presence callbacks
// to an already-subscribed channel throws, so the hook can't create it
// per instance.
const listeners = new Set()
let channel = null
let latest = 1
let idleId = null

function broadcast(n) {
  latest = n
  listeners.forEach((fn) => fn(n))
}

function start() {
  idleId = null
  if (channel || listeners.size === 0) return
  const sessionId = crypto.randomUUID?.() || Math.random().toString(36).slice(2)
  channel = supabase.channel('vxn-active-users', { config: { presence: { key: sessionId } } })
  channel
    .on('presence', { event: 'sync' }, () => {
      broadcast(Math.max(1, Object.keys(channel.presenceState()).length))
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() })
    })
}

function stop() {
  if (idleId != null) {
    if ('cancelIdleCallback' in window) window.cancelIdleCallback(idleId)
    else clearTimeout(idleId)
    idleId = null
  }
  if (channel) {
    supabase.removeChannel(channel)
    channel = null
  }
}

export function useActiveUsers() {
  const [count, setCount] = useState(latest)

  useEffect(() => {
    listeners.add(setCount)
    // Decorative UI: open the WebSocket only once the browser is idle so
    // it never competes with the page's real data fetches.
    if (!channel && idleId == null) {
      idleId = 'requestIdleCallback' in window
        ? window.requestIdleCallback(start, { timeout: 2000 })
        : setTimeout(start, 1500)
    }
    return () => {
      listeners.delete(setCount)
      if (listeners.size === 0) stop()
    }
  }, [])

  return count
}
