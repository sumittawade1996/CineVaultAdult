// Sends the daily "new videos" alert to everyone who turned the alerts on.
//
//   node scripts/send-push.mjs            dry run: counts new videos and subscribers, sends nothing
//   node scripts/send-push.mjs --send     sends one notification to every subscriber
//
// Runs every day at 19:00 IST from .github/workflows/send-push.yml. It needs four settings (GitHub secrets, or a
// local .env that is never committed):
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   (VAPID_SUBJECT is optional)
// With any of them missing it says so and stops without an error, so the workflow stays quiet until it is set up.
//
// Subscribers are stored by supabase/migrations/018_push_subscriptions.sql. Entries the push service reports as
// gone (404/410) are deleted. The message is one neutral line (scripts/lib/pushDigest.mjs).
import { existsSync, readFileSync } from 'node:fs'
import webpush from 'web-push'
import { WINDOW_HOURS, buildPayload, isGone, readConfig, shouldSend, toSubscription } from './lib/pushDigest.mjs'

const SEND = process.argv.includes('--send')
const env = { ...process.env }
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '') }

const cfg = readConfig(env)
if (cfg.missing.length) {
  console.log(`Push alerts are not set up yet (missing: ${cfg.missing.join(', ')}). Nothing sent.`)
  process.exit(0)
}

const headers = { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` }
const rest = (path, init = {}) => fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } })

// videos added in the last WINDOW_HOURS hours (exact count from the Content-Range header)
const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString()
const countRes = await rest(`movies?select=slug&created_at=gte.${encodeURIComponent(since)}&limit=1`, { headers: { Prefer: 'count=exact' } })
if (!countRes.ok) { console.error(`Could not count new videos (${countRes.status}).`); process.exit(1) }
const newVideos = Number((countRes.headers.get('content-range') || '').split('/')[1])

const subs = []
for (let from = 0; ; from += 1000) {
  const res = await rest('push_subscriptions?select=id,endpoint,p256dh,auth&order=created_at', { headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } })
  if (!res.ok) { console.error(`Could not read subscribers (${res.status}).`); process.exit(1) }
  const rows = await res.json()
  subs.push(...rows)
  if (rows.length < 1000) break
}
console.log(`${newVideos} video(s) added in the last ${WINDOW_HOURS} hours, ${subs.length} subscriber(s).`)

if (!shouldSend(newVideos)) { console.log('No new videos: no alert sent today.'); process.exit(0) }
if (!subs.length) { console.log('No subscribers yet.'); process.exit(0) }
const payload = JSON.stringify(buildPayload(newVideos))
if (!SEND) { console.log(`Dry run. Would send: ${payload}`); process.exit(0) }

webpush.setVapidDetails(cfg.subject, cfg.vapidPublic, cfg.vapidPrivate)
let sent = 0
let failed = 0
const gone = []
for (const row of subs) {
  try {
    await webpush.sendNotification(toSubscription(row), payload, { TTL: 24 * 3600, urgency: 'normal' })
    sent++
  } catch (err) {
    if (isGone(err)) gone.push(row.id)
    else { failed++; console.log(`  failed for one subscriber: ${err.statusCode || err.message}`) }
  }
}
if (gone.length) {
  const ids = gone.map((id) => `"${id}"`).join(',')
  const del = await rest(`push_subscriptions?id=in.(${ids})`, { method: 'DELETE' })
  console.log(`Removed ${gone.length} subscription(s) the push service no longer knows (${del.status}).`)
}
const stamp = await rest(`push_subscriptions?last_sent_at=is.null&id=not.in.(${gone.length ? gone.map((id) => `"${id}"`).join(',') : '"00000000-0000-0000-0000-000000000000"'})`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ last_sent_at: new Date().toISOString() }) })
console.log(`Sent ${sent}, failed ${failed}, removed ${gone.length}.`)
process.exit(failed && !sent ? 1 : 0)
