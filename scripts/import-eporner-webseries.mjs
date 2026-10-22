// Finds Indian web-series episodes of Ullu, Fliz Movies and Rabbit Movies on Eporner and writes everything needed
// to add them to VEXN.
//
//   node scripts/import-eporner-webseries.mjs                         50 episodes over the three channels
//   node scripts/import-eporner-webseries.mjs --total=50 --min=20 --max=120 --channels=ullu,fliz-movies,rabbit-movies
//
// Read-only: it reads Eporner and the site's database (public key) and writes SQL batches, a report and a summary
// into Downloads/vexn_webseries_<date>/. Applying the SQL (Supabase SQL editor or the connector) is a separate step,
// because the public key cannot write to movies (migration 004).
//
// Rules (src: scripts/lib/webSeries.mjs): 20 minutes or longer, newest first, the channel named in the title, a series
// name that can be read from the title, no blowjob, the site's content rules plus Hindi forced/family/in-law words,
// not already on the site. Posters are Eporner's 1280x720 picture (the small thumbnail only when that one is missing).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNELS, buildDescription, buildKeywords, buildSeoDescription, buildSeoTitle, buildSlug, buildTitle, excludeReason, parseTitle, tagsFor, usableSeries } from './lib/webSeries.mjs'
import { posterFrom } from './lib/studioImport.mjs'
import { checkContent } from '../src/lib/contentRules.js'
import { slugify } from '../src/lib/slugify.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const KEYS = String(args.channels || 'ullu,fliz-movies,rabbit-movies').split(',').filter((k) => CHANNELS[k])
const TOTAL = Number(args.total || 50)
const MIN = Number(args.min || 20)
const MAX = Number(args.max || 120)
const PAGES = Number(args.pages || 12)
const day = new Date().toISOString().slice(0, 10)
const OUT = args.out || join(homedir(), 'Downloads', `vexn_webseries_${day}`)
mkdirSync(OUT, { recursive: true })

// ---- environment, cache, polite HTTP ------------------------------------------------------------
const env = { ...process.env }
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const SB = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const CACHE_FILE = join(tmpdir(), 'vexn-webseries-import-cache.json')
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}
cache.search ||= {}
const saveCache = () => writeFileSync(CACHE_FILE, JSON.stringify(cache))
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let lastCall = 0
async function http(url, { json = false } = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const wait = lastCall + 600 - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall = Date.now()
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })
      if (res.ok) return json ? await res.json() : await res.text()
    } catch { /* retry */ }
    await sleep(1500 * attempt)
  }
  return null
}

// ---- what the site already has ------------------------------------------------------------------
async function sbGet(path) {
  const rows = []
  for (let from = 0; ; from += 500) {
    const res = await fetch(`${SB}/rest/v1/${path}${path.includes('?') ? '&' : '?'}offset=${from}&limit=500`, { headers: { apikey: ANON } })
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error(`database read failed: ${JSON.stringify(data).slice(0, 120)}`)
    rows.push(...data)
    if (data.length < 500) break
  }
  return rows
}
const movies = await sbGet('movies?select=slug,trailer_url,tags,seo_title,seo_description,title&order=slug')
const removed = new Set((await sbGet('removed_movies?select=slug&order=slug')).map((r) => r.slug))
const haveCodes = new Set(movies.map((m) => (m.trailer_url || '').match(/embed\/([A-Za-z0-9]+)/)?.[1]).filter(Boolean))
const haveSlugs = new Set(movies.map((m) => m.slug))
const haveSeoTitles = new Set(movies.map((m) => (m.seo_title || '').toLowerCase()))
const haveSeoDescs = new Set(movies.map((m) => (m.seo_description || '').toLowerCase()))
const haveTitles = new Set(movies.map((m) => (m.title || '').toLowerCase()))
const tagUse = new Map()
for (const m of movies) for (const t of String(m.tags || '').split(',').map((s) => s.trim()).filter(Boolean)) { const s = slugify(t); const e = tagUse.get(s) || { n: 0, names: new Map() }; e.n++; e.names.set(t, (e.names.get(t) || 0) + 1); tagUse.set(s, e) }
const freeAllowed = new Map([...tagUse].filter(([, e]) => e.n >= 3).map(([s, e]) => [s, [...e.names].sort((a, b) => b[1] - a[1])[0][0]]))
console.log(`site: ${movies.length} movies, ${haveCodes.size} Eporner codes, ${removed.size} removed addresses`)

// ---- Eporner ------------------------------------------------------------------------------------
async function apiSearch(query, page) {
  const key = `${query}|latest|${page}|lq1`
  if (!cache.search[key]) {
    const data = await http(`https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=100&page=${page}&thumbsize=big&order=latest&gay=0&lq=1&format=json`, { json: true })
    cache.search[key] = data || { videos: [], total_pages: 0 }
    saveCache()
  }
  return cache.search[key]
}
async function posterOk(url) {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0', 'user-agent': UA }, signal: AbortSignal.timeout(15000) })
    return res.status === 200 || res.status === 206
  } catch { return false }
}

// ---- candidates per channel (newest first) -----------------------------------------------------
async function candidatesFor(key) {
  const channel = CHANNELS[key]
  const skipped = {}
  const note = (why) => { const k = why.split(':')[0]; skipped[k] = (skipped[k] || 0) + 1 }
  const seen = new Map()
  for (const query of channel.queries) {
    let pages = 1
    for (let page = 1; page <= pages && page <= PAGES; page++) {
      const j = await apiSearch(query, page)
      pages = j.total_pages || 1
      for (const v of j.videos || []) seen.set(v.id, v)
    }
  }
  const out = []
  const keys = new Set()
  for (const v of [...seen.values()].sort((a, b) => String(b.added).localeCompare(String(a.added)))) {
    if (haveCodes.has(v.id)) { note('already on the site'); continue }
    const why = excludeReason({ title: v.title, keywords: v.keywords, length_sec: v.length_sec }, channel, { minMinutes: MIN, maxMinutes: MAX })
    if (why) { note(why); continue }
    const p = parseTitle(v.title, channel, v.keywords)
    if (!usableSeries(p.series)) { note('no usable series name'); continue }
    const k = `${p.series.toLowerCase()}|${p.year || ''}|${p.label.toLowerCase()}`
    if (keys.has(k)) { note('same episode uploaded twice'); continue }
    keys.add(k)
    out.push({ ...v, p })
  }
  console.log(`  ${channel.name}: ${seen.size} found, ${out.length} qualify; left out: ${JSON.stringify(skipped)}`)
  return out
}

const byChannel = {}
for (const key of KEYS) { console.log(`\n== ${CHANNELS[key].name}`); byChannel[key] = await candidatesFor(key) }

// Fliz and Rabbit are small, so every qualifying episode of them is taken; Ullu fills the rest, newest first
const picked = []
for (const key of KEYS.filter((k) => k !== 'ullu')) picked.push(...byChannel[key].map((v) => ({ ...v, key })))
const ulluRoom = Math.max(0, TOTAL - picked.length)
if (byChannel.ullu) picked.push(...byChannel.ullu.slice(0, Math.ceil(ulluRoom * 1.5)).map((v) => ({ ...v, key: 'ullu' }))) // spare ones in case some fail the final checks

// ---- build the rows -----------------------------------------------------------------------------
const rows = []
const report = []
const dropped = []
const seenSlugs = new Set(haveSlugs)
let order = 0
const counts = {}
for (const v of picked) {
  const channel = CHANNELS[v.key]
  if (rows.length >= TOTAL) break
  const reject = (why) => { dropped.push({ channel: channel.name, code: v.id, title: v.title, minutes: Math.round(v.length_sec / 60), why }) }
  const minutes = Math.round(v.length_sec / 60)
  const p = v.p
  const tags = tagsFor({ keywords: v.keywords, title: fixed(v.title), language: p.language, channel, freeAllowed })
  const tagList = tags.split(', ')
  let slug = buildSlug(p, channel)
  if (!slug) { reject('no slug'); continue }
  if (seenSlugs.has(slug)) slug = `${slug}-${minutes}-min`
  if (seenSlugs.has(slug)) { reject('slug taken'); continue }
  if (removed.has(slug)) { reject('slug was removed before'); continue }
  const title = buildTitle(p, channel, minutes)
  const seoTitle = buildSeoTitle(p, channel, minutes)
  let seoDescription = ''
  for (let salt = 0; salt < 8; salt++) {
    seoDescription = buildSeoDescription({ slug: salt ? `${slug}~${salt}` : slug, p, channel, minutes, tags: tagList })
    const k = seoDescription.toLowerCase()
    if (!haveSeoDescs.has(k) && !rows.some((r) => r.seo_description.toLowerCase() === k)) break
  }
  const description = buildDescription({ slug, p, channel, minutes, tags: tagList })
  const keywords = buildKeywords({ p, channel, tags: tagList })
  const problems = []
  if (seoTitle.length < 30 || seoTitle.length > 53) problems.push(`seo_title ${seoTitle.length}`)
  if (seoDescription.length < 140 || seoDescription.length > 160) problems.push(`seo_description ${seoDescription.length}`)
  if (description.length < 200 || description.length > 450) problems.push(`description ${description.length}`)
  if (haveSeoTitles.has(seoTitle.toLowerCase()) || rows.some((r) => r.seo_title.toLowerCase() === seoTitle.toLowerCase())) problems.push('duplicate seo_title')
  if (haveSeoDescs.has(seoDescription.toLowerCase()) || rows.some((r) => r.seo_description.toLowerCase() === seoDescription.toLowerCase())) problems.push('duplicate seo_description')
  if (haveTitles.has(title.toLowerCase()) || rows.some((r) => r.title.toLowerCase() === title.toLowerCase())) problems.push('duplicate title')
  const hits = checkContent({ title, slug, tags, keywords, description: `${description} ${seoDescription} ${seoTitle}` })
  if (hits.block.length || hits.review.length) problems.push(`content: ${[...hits.block, ...hits.review].map((h) => h.match).join(',')}`)
  if (problems.length) { reject(problems[0]); continue }
  const poster = posterFrom(v.default_thumb?.src)
  let posterUrl = poster.large && (await posterOk(poster.large)) ? poster.large : null
  if (!posterUrl && poster.small && (await posterOk(poster.small))) posterUrl = poster.small
  if (!posterUrl) { reject('no working poster'); continue }
  seenSlugs.add(slug)
  counts[channel.name] = (counts[channel.name] || 0) + 1
  rows.push({
    channel: channel.name, title, slug, poster_url: posterUrl, trailer_url: v.embed, description, keywords, tags, runtime_minutes: minutes,
    seo_title: seoTitle, seo_description: seoDescription, source_published_at: v.added, order: order++, minutes, added: v.added.slice(0, 10), code: v.id,
    large: posterUrl === poster.large, rawTitle: v.title,
  })
}
function fixed(t) { return String(t || '').replace(/[^\x20-\x7e]+/g, ' ') }
console.log(`\naccepted: ${JSON.stringify(counts)}; dropped at the final checks: ${JSON.stringify(dropped.reduce((a, d) => ({ ...a, [d.why]: (a[d.why] || 0) + 1 }), {}))}`)

// ---- write SQL batches, report and summary ------------------------------------------------------
const q = (s) => (s == null ? 'null' : `$q$${String(s)}$q$`)
const BATCH = 10
const cols = 'title, slug, poster_url, trailer_url, description, keywords, tags, actors, channel, runtime_minutes, seo_title, seo_description, featured, created_at, source, source_published_at'
for (let i = 0; i < rows.length; i += BATCH) {
  const part = rows.slice(i, i + BATCH)
  const values = part.map((r) => `  (${[q(r.title), q(r.slug), q(r.poster_url), q(r.trailer_url), q(r.description), q(r.keywords), q(r.tags), 'null', q(r.channel), r.runtime_minutes, q(r.seo_title), q(r.seo_description), 'false', `now() - interval '${r.order} seconds'`, q('Eporner'), `${q(r.source_published_at)}::timestamptz`].join(', ')})`)
  writeFileSync(join(OUT, `batch-${String(i / BATCH + 1).padStart(2, '0')}.sql`), `insert into public.movies (${cols})\nvalues\n${values.join(',\n')}\non conflict (slug) do nothing\nreturning slug;\n`)
}
const csv = ['channel,slug,minutes,added,title,seo_title,seo_description,tags,poster,raw_title,eporner_code', ...rows.map((r) => [r.channel, r.slug, r.minutes, r.added, r.title, r.seo_title, r.seo_description, r.tags, r.large ? '1280x720' : 'small thumbnail', r.rawTitle, r.code].map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(','))]
writeFileSync(join(OUT, 'report.csv'), '﻿' + csv.join('\n'))
writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ rules: { minMinutes: MIN, maxMinutes: MAX, total: TOTAL }, counts, dropped, total: rows.length }, null, 1))
console.log(`\n${rows.length} episodes ready; ${Math.ceil(rows.length / BATCH)} SQL batches, report.csv and summary.json in ${OUT}`)
