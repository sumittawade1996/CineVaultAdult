// node scripts/check-dead-embeds.mjs [--limit N] [--delay MS] [--out report.csv] [--fail-on-dead]
//
// Weekly source check (plan T18). Asks Eporner / Pornhub whether each embedded
// video still exists. A video counts as removed only when the source says so
// on two checks a few seconds apart; network errors and rate limits are never
// treated as "removed".
//
// REPORT ONLY: nothing is changed or deleted. To remove a confirmed video, do
// it in the admin page (which records the 410) or with SQL, after reading the
// report. See .github/workflows/check-dead-embeds.yml for the weekly run.
//
//   --limit N       check only the first N videos (testing)
//   --delay MS      pause between requests, default 1000 (about 1 request/second)
//   --out FILE      also write the confirmed list as CSV
//   --fail-on-dead  exit with code 1 when a video is confirmed removed
//                   (lets a scheduled job raise a notification)

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { apiUrl, classify, sourceOf } from './lib/embedCheck.mjs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const LIMIT = Number(value('limit', 0)) || Infinity
const DELAY = Number(value('delay', 1000))
const OUT = value('out', '')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.')
  process.exit(2)
}
const supabase = createClient(url, key)

async function loadMovies() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('movies').select('slug,title,trailer_url').order('slug').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

async function check(target) {
  try {
    const res = await fetch(apiUrl(target), {
      headers: { 'user-agent': UA, accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    })
    return { state: classify(target.source, res.status, await res.text()), status: res.status }
  } catch (err) {
    return { state: 'error', status: 0, note: err.message }
  }
}

const movies = await loadMovies()
const targets = []
let skipped = 0
for (const m of movies) {
  const t = sourceOf(m.trailer_url)
  if (t) targets.push({ ...m, ...t })
  else skipped++
}
const queue = targets.slice(0, LIMIT)
console.log(`${movies.length} movies: ${targets.length} embedded from Eporner/Pornhub (${skipped} other hosts are not checked); checking ${queue.length}`)

// Pass 1
const firstDead = []
let errors = 0
let done = 0
for (const t of queue) {
  const r = await check(t)
  if (r.state === 'dead') firstDead.push(t)
  if (r.state === 'error') errors++
  if (++done % 100 === 0) console.log(`  ${done}/${queue.length} checked`)
  await sleep(DELAY)
}

// Pass 2: only the ones pass 1 called removed
const confirmed = []
if (firstDead.length) {
  console.log(`${firstDead.length} looked removed; checking them again in 10 seconds`)
  await sleep(10000)
  for (const t of firstDead) {
    const r = await check(t)
    if (r.state === 'dead') confirmed.push(t)
    else console.log(`  not confirmed (${r.state}): ${t.slug}`)
    await sleep(DELAY)
  }
}

console.log(`\nChecked ${queue.length}: ${confirmed.length} confirmed removed at the source, ${errors} requests failed or were unclear (not counted as removed).`)
for (const t of confirmed) console.log(`  REMOVED  ${t.source}/${t.code}  ${t.slug}  "${t.title}"`)
if (confirmed.length) {
  console.log('\nNothing was changed. Remove these in the admin page, or hand the slugs to Claude.')
}

if (OUT) {
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const csv = ['slug,title,source,code,checked_at', ...confirmed.map((t) => [t.slug, t.title, t.source, t.code, new Date().toISOString()].map(esc).join(','))].join('\n')
  writeFileSync(OUT, '﻿' + csv + '\n')
  console.log(`Wrote ${OUT}`)
}
if (flag('fail-on-dead') && confirmed.length) process.exit(1)
