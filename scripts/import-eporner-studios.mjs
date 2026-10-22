// Finds new videos of studios on Eporner and writes everything needed to add them to VEXN.
//
//   node scripts/import-eporner-studios.mjs                      all four studios, 25 videos each
//   node scripts/import-eporner-studios.mjs --studios=brazzers --per=30 --min=20 --max=90
//
// Read-only: it reads Eporner and the site's database (public key) and writes SQL batches, a report and a
// summary into Downloads/vexn_import_<date>/. Applying the SQL (Supabase SQL editor or the connector) is a
// separate step, because the public key cannot write to movies (migration 004).
//
// Rules (src: scripts/lib/studioImport.mjs): 20 minutes or longer, newest first, no blowjob, the site's content
// rules plus a stricter guard, the studio named (or the official channel), not already on the site.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { STUDIOS, buildSeoDescription, buildSeoTitleUnique, buildSlug, castFromTitle, cleanCast, buildTitle, excludeReason, mapTags, mentionsBlowjob, posterFrom, sceneTitle } from './lib/studioImport.mjs'
import { draftDescription } from './lib/movieCopy.mjs'
import { checkContent } from '../src/lib/contentRules.js'
import { slugify } from '../src/lib/slugify.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const KEYS = String(args.studios || 'brazzers,vixen,bangbros,adult-time').split(',').filter((k) => STUDIOS[k])
const PER = Number(args.per || 25)
const MIN = Number(args.min || 20)
const MAX = Number(args.max || 90)
const PAGES = Number(args.pages || 40) // listing pages of 100 videos read per search
// --allow-blowjob prepares a HELD set: only videos that the normal rules leave out for blowjob, written to its own
// folder and never applied without the owner's say-so. --strict-title refuses uploads that name the studio only in keywords.
const HELD = Boolean(args['allow-blowjob'])
const STRICT_TITLE = Boolean(args['strict-title'])
const day = new Date().toISOString().slice(0, 10)
const OUT = args.out || join(homedir(), 'Downloads', `vexn_import_${day}${HELD ? '_blowjob-held' : ''}`)
mkdirSync(OUT, { recursive: true })

// ---- environment, cache, polite HTTP ------------------------------------------------------------
const env = { ...process.env }
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const SB = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const CACHE_FILE = join(tmpdir(), 'vexn-studio-import-cache.json')
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}
for (const k of ['search', 'id', 'watch', 'listing']) cache[k] ||= {}
const saveCache = () => writeFileSync(CACHE_FILE, JSON.stringify(cache))
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let lastCall = 0
async function http(url, { json = false, headers = {} } = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const wait = lastCall + 750 - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall = Date.now()
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, ...headers }, signal: AbortSignal.timeout(30000) })
      if (res.status === 404 || res.status === 410) return { status: res.status, data: null }
      if (res.ok) return { status: res.status, data: json ? await res.json() : await res.text() }
    } catch { /* retry */ }
    await sleep(1500 * attempt)
  }
  return { status: 0, data: null }
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
// free tags the site already uses at least 3 times (so a new video does not bring one-off tags)
const tagUse = new Map()
for (const m of movies) for (const t of String(m.tags || '').split(',').map((s) => s.trim()).filter(Boolean)) { const s = slugify(t); const e = tagUse.get(s) || { n: 0, names: new Map() }; e.n++; e.names.set(t, (e.names.get(t) || 0) + 1); tagUse.set(s, e) }
const freeAllowed = new Map([...tagUse].filter(([, e]) => e.n >= 3).map(([s, e]) => [s, [...e.names].sort((a, b) => b[1] - a[1])[0][0]]))
console.log(`site: ${movies.length} movies, ${haveCodes.size} Eporner codes, ${removed.size} removed addresses, ${freeAllowed.size} reusable free tags`)

// ---- Eporner readers ----------------------------------------------------------------------------
async function apiSearch(query, page, lq = 0) {
  const key = lq ? `${query}|latest|${page}|lq${lq}` : `${query}|latest|${page}`
  if (!cache.search[key]) {
    const { data } = await http(`https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=100&page=${page}&thumbsize=big&order=latest&gay=0&lq=${lq}&format=json`, { json: true })
    cache.search[key] = data || { videos: [], total_pages: 0 }
    saveCache()
  }
  return cache.search[key]
}
async function apiId(code) {
  if (!cache.id[code]) {
    const { data } = await http(`https://www.eporner.com/api/v2/video/id/?id=${code}&thumbsize=big&format=json`, { json: true })
    cache.id[code] = data && !Array.isArray(data) ? data : { missing: true }
    saveCache()
  }
  return cache.id[code]
}
const parseListing = (html) => [...html.matchAll(/<div class="mb"[^>]*data-id="\d+"[\s\S]*?href="\/video-([A-Za-z0-9]+)\/[^"]*"[\s\S]*?class="mbtim"[^>]*>([^<]+)</g)]
  .map((m) => { const p = m[2].split(':').map(Number); return { code: m[1], sec: p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1] } })
async function channelLongest(slug) {
  const found = []
  for (let page = 1; page <= 12; page++) {
    const key = `${slug}|longest|${page}`
    if (!cache.listing[key]) {
      const { data } = await http(`https://www.eporner.com/channel/${slug}/longest/${page > 1 ? page + '/' : ''}`)
      cache.listing[key] = data ? parseListing(data) : []
      saveCache()
    }
    const items = cache.listing[key]
    if (!items.length) break
    found.push(...items.filter((i) => i.sec >= MIN * 60))
    if (items.every((i) => i.sec < MIN * 60)) break // longest first: nothing further can qualify
  }
  return found
}
async function watchPage(code) {
  if (!cache.watch[code]) {
    const { status, data } = await http(`https://www.eporner.com/video-${code}/`)
    if (!data) cache.watch[code] = { status, dead: true }
    else {
      const cast = [...data.matchAll(/<li class="vit-pornstar[^"]*"><a href="\/pornstar\/[^"]+" title="([^"(]+?) \((?:Female|Male)\)"/g)].map((m) => m[1].trim())
      const ch = data.match(/<li class="vit-channel"><a href="\/channel\/([^"]+)\/" title="Channel">([^<]+)<\/a>/)
      cache.watch[code] = { status, cast: [...new Set(cast)], channel: ch?.[1] || null }
    }
    saveCache()
  }
  return cache.watch[code]
}
async function posterOk(url) {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0', 'user-agent': UA }, signal: AbortSignal.timeout(15000) })
    return res.status === 200 || res.status === 206
  } catch { return false }
}

// ---- candidates per studio ----------------------------------------------------------------------
async function candidatesFor(key) {
  const studio = STUDIOS[key]
  const skipped = {}
  const note = (why) => { skipped[why.split(':')[0]] = (skipped[why.split(':')[0]] || 0) + 1 }
  const out = []
  const consider = (v, verifiedChannel) => {
    if (haveCodes.has(v.id)) return note('already on the site')
    const why = excludeReason({ title: v.title, keywords: v.keywords, length_sec: v.length_sec }, studio, { minMinutes: MIN, maxMinutes: MAX, verifiedChannel, allowKeywordBrand: !STRICT_TITLE, allowBlowjob: HELD })
    if (why) return note(why)
    if (HELD && !mentionsBlowjob(`${v.title} ${v.keywords}`)) return note('not a blowjob video (in the normal set)')
    out.push({ ...v, verifiedChannel, brandInKeywordsOnly: !verifiedChannel && !studio.brand.test(v.title || '') })
  }
  if (studio.channels.length) {
    for (const ch of studio.channels) {
      const listed = await channelLongest(ch)
      console.log(`  ${studio.name}: channel ${ch} lists ${listed.length} videos of ${MIN}+ minutes`)
      for (const item of listed) { const v = await apiId(item.code); if (!v.missing) consider(v, true) }
    }
  }
  const newestFirst = (list) => list.sort((a, b) => String(b.added).localeCompare(String(a.added)))
  const scan = async (lq) => {
    const before = out.length
    for (const query of studio.queries || []) {
      let pages = 1
      for (let page = 1; page <= pages && page <= PAGES; page++) {
        const j = await apiSearch(query, page, lq)
        pages = j.total_pages || 1
        for (const v of j.videos || []) if (!out.some((o) => o.id === v.id)) consider(v, false)
        if (out.length - before >= PER * 3) break // newest first: enough to choose from
      }
    }
    return out.slice(before)
  }
  await scan(0)
  const base = newestFirst([...out]) // the official channel's videos (if any) and the normal listings
  // Quality first: Eporner's low-quality listings are only used when the normal ones cannot fill the quota
  let extra = []
  if (base.length < PER + 10) {
    extra = newestFirst(await scan(1)).map((v) => ({ ...v, lowQualityListing: true }))
    console.log(`  ${studio.name}: ${base.length} from the normal listings were not enough, ${extra.length} more from the low-quality listings`)
  }
  // videos from before 2022 only come last, when nothing newer fills the quota
  const CUTOFF = '2022-01-01'
  const ordered = [...base.filter((v) => String(v.added) >= CUTOFF), ...extra, ...base.filter((v) => String(v.added) < CUTOFF)]
  console.log(`  ${studio.name}: ${ordered.length} qualify before the cast check; left out: ${JSON.stringify(skipped)}`)
  return { out: ordered, skipped }
}

// ---- build the rows -----------------------------------------------------------------------------
const rows = []
const report = []
const droppedLate = []
const seenSlugs = new Set(haveSlugs)
let order = 0
for (const key of KEYS) {
  const studio = STUDIOS[key]
  console.log(`\n== ${studio.name}`)
  const { out, skipped } = await candidatesFor(key)
  let accepted = 0
  const rejects = {}
  for (const v of out) {
    if (accepted >= PER) break
    const reject = (why) => { rejects[why] = (rejects[why] || 0) + 1; droppedLate.push({ studio: studio.name, code: v.id, title: v.title, minutes: Math.round(v.length_sec / 60), why }) }
    const w = await watchPage(v.id)
    if (w.dead) { reject('video page gone'); continue }
    if (studio.channels.length === 0 && w.channel && !studio.channels.includes(w.channel) && !studio.brand.test(`${v.title} ${v.keywords}`)) { reject('other channel'); continue }
    const cast = cleanCast(w.cast?.length ? w.cast : castFromTitle(v.title, studio), studio) // the credited performers (one entry per person), else the names in a file-name style title
    // an upload that names the studio only in its keywords needs a credited performer as further evidence
    if (v.brandInKeywordsOnly && cast.length === 0) { reject('studio only in keywords and no credited performer'); continue }
    const minutes = Math.round(v.length_sec / 60)
    const tags = mapTags(v.keywords, studio, freeAllowed)
    const tagList = tags.split(', ')
    const titleArgs = { cast, rawTitle: v.title, studio }
    let slug = buildSlug(titleArgs)
    if (!slug) { reject('no slug'); continue }
    if (seenSlugs.has(slug)) slug = `${slug}-${minutes}-min`
    if (seenSlugs.has(slug)) { reject('slug taken'); continue }
    if (removed.has(slug)) { reject('slug was removed before'); continue }
    const title = buildTitle(titleArgs)
    const takenSeo = new Set([...haveSeoTitles, ...rows.map((r) => r.seo_title.toLowerCase())])
    const seoTitle = buildSeoTitleUnique({ ...titleArgs, minutes, tags: tagList }, takenSeo)
    // two videos with the same performer and length would read alike: try other wordings before giving up
    let seoDescription = ''
    for (let salt = 0; salt < 8; salt++) {
      seoDescription = buildSeoDescription({ slug: salt ? `${slug}~${salt}` : slug, studio, cast, minutes, tags: tagList, scene: sceneTitle(v.title, cast, studio) })
      const key = seoDescription.toLowerCase()
      if (!haveSeoDescs.has(key) && !rows.some((r) => r.seo_description.toLowerCase() === key)) break
    }
    const forCopy = { slug, title, actors: cast.join(', '), runtime_minutes: minutes, tags, channel: studio.name, source: 'Eporner' }
    const description = draftDescription(forCopy)
    const keywords = [...new Set([studio.name, ...(/exxtra/i.test(v.title) ? ['Brazzers Exxtra'] : []), ...cast, ...tagList.slice(1)])].join(', ')
    // final checks on what will be published
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
    rows.push({
      studio: studio.name, title, slug, poster_url: posterUrl, trailer_url: v.embed, description, keywords, tags, actors: cast.length ? cast.join(', ') : null,
      channel: studio.name, runtime_minutes: minutes, seo_title: seoTitle, seo_description: seoDescription, source_published_at: v.added, order: order++, minutes, added: v.added.slice(0, 10), code: v.id,
      lowQuality: Boolean(v.lowQualityListing), officialChannel: Boolean(v.verifiedChannel), brandInKeywordsOnly: Boolean(v.brandInKeywordsOnly), blowjob: mentionsBlowjob(`${v.title} ${v.keywords}`),
    })
    accepted++
  }
  console.log(`  ${studio.name}: accepted ${accepted} of ${PER}; dropped at the final checks: ${JSON.stringify(rejects)}`)
  report.push({ studio: studio.name, accepted, wanted: PER, qualified: out.length, leftOut: skipped, droppedLate: rejects })
}

// ---- write SQL batches, report and summary ------------------------------------------------------
const q = (s) => (s == null ? 'null' : `$q$${String(s)}$q$`)
const BATCH = 10
const cols = 'title, slug, poster_url, trailer_url, description, keywords, tags, actors, channel, runtime_minutes, seo_title, seo_description, featured, created_at, source, source_published_at'
for (let i = 0; i < rows.length; i += BATCH) {
  const part = rows.slice(i, i + BATCH)
  const values = part.map((r) => `  (${[q(r.title), q(r.slug), q(r.poster_url), q(r.trailer_url), q(r.description), q(r.keywords), q(r.tags), q(r.actors), q(r.channel), r.runtime_minutes, q(r.seo_title), q(r.seo_description), 'false', `now() - interval '${r.order} seconds'`, q('Eporner'), `${q(r.source_published_at)}::timestamptz`].join(', ')})`)
  writeFileSync(join(OUT, `batch-${String(i / BATCH + 1).padStart(2, '0')}.sql`), `insert into public.movies (${cols})\nvalues\n${values.join(',\n')}\non conflict (slug) do nothing\nreturning slug;\n`)
}
const csv = ['studio,slug,minutes,added,title,seo_title,seo_description,tags,actors,source_listing,studio_evidence,blowjob,eporner_code', ...rows.map((r) => [r.studio, r.slug, r.minutes, r.added, r.title, r.seo_title, r.seo_description, r.tags, r.actors, r.officialChannel ? 'official channel' : r.lowQuality ? 'low-quality listing' : 'normal listing', r.officialChannel ? 'official channel' : r.brandInKeywordsOnly ? 'studio in keywords + credited performer' : 'studio in title', r.blowjob ? 'yes' : 'no', r.code].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))]
writeFileSync(join(OUT, 'report.csv'), '﻿' + csv.join('\n'))
writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ rules: { minMinutes: MIN, maxMinutes: MAX, perStudio: PER }, report, droppedLate, total: rows.length }, null, 1))
console.log(`\n${rows.length} videos ready; ${Math.ceil(rows.length / BATCH)} SQL batches, report.csv and summary.json in ${OUT}`)
