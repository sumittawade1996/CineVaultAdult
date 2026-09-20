// One-off: fill poster_url for movies that have none, using a static
// thumbnail derived from the trailer embed (Eporner API / YouTube).
//
//   node scripts/backfill-posters.mjs           # dry run — prints what would change
//   node scripts/backfill-posters.mjs --apply   # writes poster_url for the listed rows
//
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from the environment
// or from .env in the project root. Rows that already have a poster are
// never touched; providers without a thumbnail source are skipped.

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { youtubeId, epornerId } from '../src/lib/poster.js'

function loadDotEnv() {
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}
loadDotEnv()

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.')
  process.exit(1)
}
const apply = process.argv.includes('--apply')
const supabase = createClient(url, key)

async function epornerThumb(id) {
  const res = await fetch(`https://www.eporner.com/api/v2/video/id/?id=${id}&thumbsize=big`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  })
  if (!res.ok) return null
  const text = await res.text()
  try {
    const json = JSON.parse(text)
    return json?.default_thumb?.src || null
  } catch {
    return null
  }
}

const { data: rows, error } = await supabase
  .from('movies')
  .select('id, slug, title, trailer_url, poster_url')
  .is('poster_url', null)
  .order('created_at', { ascending: false })
if (error) {
  console.error('Could not read movies:', error.message)
  process.exit(1)
}

const updates = []
const skipped = []
for (const row of rows) {
  const yt = youtubeId(row.trailer_url)
  const ep = epornerId(row.trailer_url)
  let poster = null
  if (yt) poster = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`
  else if (ep) poster = await epornerThumb(ep)
  if (poster) updates.push({ id: row.id, slug: row.slug, poster })
  else skipped.push({ slug: row.slug, trailer_url: row.trailer_url })
}

console.log(`${rows.length} movies without a poster. ${updates.length} can be filled, ${skipped.length} skipped.\n`)
for (const u of updates) console.log(`  ${u.slug}\n    -> ${u.poster}`)
if (skipped.length) {
  console.log('\nSkipped (no thumbnail source — set poster_url manually):')
  for (const s of skipped) console.log(`  ${s.slug}  (${s.trailer_url})`)
}

if (!apply) {
  console.log('\nDry run. Re-run with --apply to write these poster_url values.')
  process.exit(0)
}

let ok = 0
for (const u of updates) {
  const { error: upErr } = await supabase.from('movies').update({ poster_url: u.poster }).eq('id', u.id)
  if (upErr) console.error(`  FAILED ${u.slug}: ${upErr.message}`)
  else ok++
}
console.log(`\nUpdated ${ok}/${updates.length} movies.`)
