// Pure pieces of the daily "new videos" alert (scripts/send-push.mjs). No network here, so they can be tested.
//
// One digest per day, never one notification per video: bulk imports add dozens of videos at a time. The
// message is deliberately neutral (no video title) because it shows on a lock screen.

// Videos added in this window count as "new" for the digest.
export const WINDOW_HOURS = 24

// A digest is worth sending when at least one video was added in the window.
export const shouldSend = (newVideos) => Number.isFinite(newVideos) && newVideos > 0

// -> the JSON the service worker (public/sw.js) shows
export function buildPayload(newVideos) {
  const body = newVideos === 1 ? 'A new video was added today.' : 'New videos were added today.'
  return { title: 'VEXN', body, url: '/new' }
}

// The push service answers 404 or 410 when the subscription no longer exists (the visitor removed the
// permission or uninstalled the browser): such entries are deleted.
export const isGone = (err) => Boolean(err) && (err.statusCode === 404 || err.statusCode === 410)

// -> { endpoint, keys: { p256dh, auth } } as web-push wants it
export const toSubscription = (row) => ({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } })

// Settings come from the environment; a missing one means the alerts are simply not set up yet.
export function readConfig(env) {
  const vapidPublic = env.VAPID_PUBLIC_KEY || env.VITE_VAPID_PUBLIC_KEY || ''
  const missing = []
  if (!(env.VITE_SUPABASE_URL || env.SUPABASE_URL)) missing.push('VITE_SUPABASE_URL')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!vapidPublic) missing.push('VAPID_PUBLIC_KEY')
  if (!env.VAPID_PRIVATE_KEY) missing.push('VAPID_PRIVATE_KEY')
  return {
    missing,
    supabaseUrl: env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    vapidPublic,
    vapidPrivate: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || 'https://vexn.org',
  }
}
