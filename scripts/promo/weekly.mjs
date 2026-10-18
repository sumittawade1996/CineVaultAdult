// node scripts/promo/weekly.mjs                 print the "new this week" Telegram message (dry run)
// node scripts/promo/weekly.mjs --send          post it; needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the environment
//
// One text message with one link, tagged with UTM (plan section 9, item 4). It links the New page rather
// than single videos, so the preview card is the VEXN share image and not a video poster.
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { buildUtm } from './utm.mjs'
import { weekKey, weekLabel } from '../../src/lib/weeks.js'
import { classifyTag } from '../../src/lib/categories.js'

// movies: [{ created_at, tags }] added in the last 7 days. Returns null when there is nothing to say.
export function composeWeekly(movies, now = new Date()) {
  if (!movies.length) return null
  const counts = new Map()
  for (const m of movies) {
    for (const raw of String(m.tags || '').split(',')) {
      const name = raw.trim()
      if (name && classifyTag(name) === 'controlled') counts.set(name, (counts.get(name) || 0) + 1)
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([n]) => n)
  const key = weekKey(now)
  const campaign = `new-${key}`
  const link = buildUtm('/new', { source: 'telegram', medium: 'channel', campaign })
  const n = movies.length
  const lines = [
    `New on VEXN: ${n} ${n === 1 ? 'video' : 'videos'} added in the last 7 days.`,
    top.length ? `Mostly ${top.join(', ')}.` : null,
    `See them all, newest first: ${link}`,
    '18+ only.',
  ].filter(Boolean)
  return { text: lines.join('\n'), link, campaign, week: weekLabel(key) }
}

async function main() {
  if (existsSync('.env')) {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/movies?select=created_at,tags&created_at=gte.${encodeURIComponent(since)}&limit=1000`, { headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY } })
  const movies = await res.json()
  const msg = composeWeekly(Array.isArray(movies) ? movies : [])
  if (!msg) { console.log('Nothing was added in the last 7 days; no message to post.'); return }
  console.log(msg.text)
  if (!process.argv.includes('--send')) { console.log('\n(dry run: add --send to post it)'); return }
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env
  if (!token || !chat) throw new Error('set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID first')
  const out = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: msg.text }),
  })
  console.log(out.ok ? 'posted' : `Telegram answered HTTP ${out.status}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1) })
