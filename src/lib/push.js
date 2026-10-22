// "New videos" alerts (web push). The browser gives us a push address and two keys when the visitor allows
// notifications; they are stored through public.push_subscribe (supabase/migrations/018_push_subscriptions.sql)
// and used once a day by scripts/send-push.mjs. Nothing here runs unless the visitor presses the button.
import { supabase } from './supabase'
import { keyToBytes } from './pushKey'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
const VISITS_KEY = 'vexn_visits'

export const pushConfigured = () => Boolean(VAPID_PUBLIC_KEY)

export function pushSupported() {
  return typeof window !== 'undefined' && pushConfigured() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

// Counts page loads in this browser (one number in localStorage, never sent anywhere). The button is offered
// from the second visit on, or at once in the installed app, never on a first visit.
export function countVisit() {
  try {
    const n = Number(localStorage.getItem(VISITS_KEY) || 0) + 1
    localStorage.setItem(VISITS_KEY, String(n))
    return n
  } catch {
    return 0
  }
}
export const readVisits = () => {
  try { return Number(localStorage.getItem(VISITS_KEY) || 0) } catch { return 0 }
}
export const mayOffer = () => isStandalone() || readVisits() >= 2

// "Not now" on the prompt (a time) and "I turned the alerts off" (never ask again) live in localStorage too.
const DISMISSED_KEY = 'vexn-push-dismissed'
const OPTOUT_KEY = 'vexn-push-optout'
const ageConfirmed = () => { try { return localStorage.getItem('vexn-age-verified') === '1' } catch { return false } }
export function promptContext() {
  let dismissedAt = 0
  let optedOut = false
  try { dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0); optedOut = localStorage.getItem(OPTOUT_KEY) === '1' } catch { /* blocked storage: treated as never dismissed */ }
  return { visits: readVisits(), standalone: isStandalone(), ageOk: ageConfirmed(), dismissedAt, optedOut, now: Date.now() }
}
export function dismissPrompt() { try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* ignore */ } }

// 'unsupported' | 'denied' | 'subscribed' | 'available'
export async function pushState() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return sub && Notification.permission === 'granted' ? 'subscribed' : 'available'
  } catch {
    return 'unsupported'
  }
}

// -> { ok: true } | { ok: false, reason: 'denied' | 'unsupported' | 'failed' }
export async function subscribePush() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'denied' }
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }))
    const json = sub.toJSON()
    const { error } = await supabase.rpc('push_subscribe', { p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth })
    if (error) { await sub.unsubscribe().catch(() => {}); return { ok: false, reason: 'failed' } }
    try { localStorage.removeItem(OPTOUT_KEY) } catch { /* ignore */ }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

export async function unsubscribePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) {
      const endpoint = sub.endpoint
      await sub.unsubscribe()
      await supabase.rpc('push_unsubscribe', { p_endpoint: endpoint })
    }
    try { localStorage.setItem(OPTOUT_KEY, '1') } catch { /* ignore */ } // someone who turned it off is not asked again
    return true
  } catch {
    return false
  }
}
