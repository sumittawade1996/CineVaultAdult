// Runs before every build (see package.json "build" script).
// Pulls every movie + article from Supabase and writes a fresh set of sitemap
// files so Google always sees current URLs, including ones added via bulk CSV
// upload or directly in the database.
//
// Instead of one flat sitemap.xml, this writes a *sitemap index*
// (public/sitemap.xml) that points at separate files:
//   sitemap-pages.xml     static routes (home, /movies, /new, /articles, ...) and the
//                         weekly /new/<week> archives with enough additions
//   sitemap-movies.xml    every movie, with <image:image> tags for posters
//   sitemap-video.xml     every movie with a poster, as <video:video> entries
//   sitemap-articles.xml  every article, with cover image tags
//   sitemap-taxonomy.xml  the actor/channel/category pages worth indexing
//
// Why split it up: a single sitemap is capped at 50,000 URLs / 50MB by
// the sitemap spec, splitting by type keeps each file small and lets
// Search Console show per-type indexing stats (e.g. "movies: 480/500
// indexed" separately from "articles: 12/12 indexed"), which makes it
// much easier to spot problems in one content type without digging.
//
// Rules (plan T5 / T10):
//  - `lastmod` is the row's real updated_at, never "today". A page-level
//    lastmod is the newest updated_at of the rows it lists.
//  - Only pages that are indexable appear. Taxonomy pages follow
//    src/lib/indexing.js (the same rules that set `noindex` on the page).
//  - Video entries carry <video:family_friendly>no</video:family_friendly>.
//  - public/robots.txt is the source of truth for crawl rules; this script
//    only refreshes its `Sitemap:` line.
//
// Set SITEMAP_OUT_DIR to write somewhere other than ./public (used by tests).

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { slugify } from '../src/lib/slugify.js'
import { isHeldMovie, isIndexableTaxonomy, isIndexableWeek } from '../src/lib/indexing.js'
import { summarizeWeeks, weekKey } from '../src/lib/weeks.js'
import { toEmbedUrl } from '../src/lib/video.js'

// Netlify injects env vars; local runs read .env like Vite does.
function loadDotEnv() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadDotEnv()

const OUT_DIR = process.env.SITEMAP_OUT_DIR || 'public'
const SITE_URL = (process.env.SITE_URL || 'https://vexn.org').replace(/\/$/, '')
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const PAGE = 1000 // PostgREST returns at most this many rows per request

// lastmod: 'movies' = newest movie, 'articles' = newest article, none = omitted
const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0', lastmodFrom: 'movies' },
  { path: '/movies', changefreq: 'daily', priority: '0.9', lastmodFrom: 'movies' },
  { path: '/new', changefreq: 'daily', priority: '0.8', lastmodFrom: 'movies' },
  { path: '/articles', changefreq: 'daily', priority: '0.7', lastmodFrom: 'articles' },
  { path: '/actors', changefreq: 'weekly', priority: '0.6', lastmodFrom: 'movies' },
  { path: '/channels', changefreq: 'weekly', priority: '0.6', lastmodFrom: 'movies' },
  { path: '/categories', changefreq: 'weekly', priority: '0.6', lastmodFrom: 'movies' },
  { path: '/legal/terms', changefreq: 'yearly', priority: '0.2' },
  { path: '/legal/privacy', changefreq: 'yearly', priority: '0.2' },
  { path: '/legal/dmca', changefreq: 'yearly', priority: '0.2' },
  { path: '/legal/2257', changefreq: 'yearly', priority: '0.2' },
]

function xmlEscape(str) {
  return String(str)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const day = (value) => (value ? String(value).slice(0, 10) : undefined)
const newest = (values) => values.filter(Boolean).map(day).sort().pop()

// Counts how many movies are filed under each slug of a field and remembers
// the newest updated_at among them. Keeps only the pages that are indexable.
function indexableTaxonomy(rows, field, { single = false } = {}) {
  const stats = new Map()
  for (const row of rows) {
    const names = single ? [row[field]] : (row[field] || '').split(',')
    for (const slug of new Set(names.map((s) => (s || '').trim()).filter(Boolean).map(slugify))) {
      const s = stats.get(slug) || { count: 0, lastmod: undefined }
      s.count += 1
      const d = day(row.updated_at)
      if (d && (!s.lastmod || d > s.lastmod)) s.lastmod = d
      stats.set(slug, s)
    }
  }
  return [...stats]
    .filter(([slug, s]) => isIndexableTaxonomy(field, slug, s.count))
    .map(([slug, s]) => ({ slug, lastmod: s.lastmod }))
}

function urlEntry(loc, { changefreq, priority, lastmod, image, extra }) {
  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : '',
    priority ? `    <priority>${priority}</priority>` : '',
    image ? `    <image:image><image:loc>${xmlEscape(image)}</image:loc></image:image>` : '',
    extra || '',
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n')
}

function urlset(entries, { image = false, video = false } = {}) {
  const ns = [
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    image ? 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '',
    video ? 'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"' : '',
  ].filter(Boolean).join(' ')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${ns}>\n${entries.join('\n')}\n</urlset>\n`
}

// <video:video> block for one movie, or null when Google's required fields
// (thumbnail, title, description, player) are missing.
function videoBlock(m) {
  const thumbnail = m.poster_url
  const player = toEmbedUrl(m.trailer_url)
  const title = (m.seo_title || m.title || '').trim().slice(0, 100)
  const description = (m.description || m.seo_description || '').trim().slice(0, 2000)
  if (!thumbnail || !player || !title || !description) return null
  const seconds = m.runtime_minutes > 0 ? Math.min(Math.round(m.runtime_minutes * 60), 28800) : null
  const published = day(m.source_published_at) || day(m.created_at)
  const tags = (m.tags || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10)
  return [
    '    <video:video>',
    `      <video:thumbnail_loc>${xmlEscape(thumbnail)}</video:thumbnail_loc>`,
    `      <video:title>${xmlEscape(title)}</video:title>`,
    `      <video:description>${xmlEscape(description)}</video:description>`,
    `      <video:player_loc>${xmlEscape(player)}</video:player_loc>`,
    seconds ? `      <video:duration>${seconds}</video:duration>` : '',
    published ? `      <video:publication_date>${published}</video:publication_date>` : '',
    '      <video:family_friendly>no</video:family_friendly>',
    ...tags.map((t) => `      <video:tag>${xmlEscape(t)}</video:tag>`),
    '    </video:video>',
  ].filter(Boolean).join('\n')
}

// Reads a whole table in pages of PAGE rows (a single request stops at 1000).
async function fetchAll(build) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) return { rows, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return { rows, error: null }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  let movies = []
  let articles = []
  // Categories whose copy row says is_indexable = false stay out of the sitemap
  // (the page itself carries noindex too).
  const hiddenCategories = new Set()

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const baseFields = 'slug, title, seo_title, seo_description, description, keywords, trailer_url, poster_url, runtime_minutes, tags, actors, channel, created_at, updated_at'

    let result = await fetchAll(() =>
      supabase.from('movies').select(`${baseFields}, source_published_at`).order('updated_at', { ascending: false }).order('slug')
    )
    if (result.error) {
      // Older database without the source_published_at column (migration 007).
      console.warn('[sitemap] retrying without source_published_at:', result.error.message)
      result = await fetchAll(() =>
        supabase.from('movies').select(baseFields).order('updated_at', { ascending: false }).order('slug')
      )
    }
    if (result.error) console.warn('[sitemap] could not fetch movies:', result.error.message)
    else {
      // Held videos (blocked theme, awaiting a decision) stay out of every sitemap and out of the counts.
      movies = result.rows.filter((m) => !isHeldMovie(m))
      if (movies.length !== result.rows.length) console.log(`[sitemap] ${result.rows.length - movies.length} held videos left out`)
    }

    const articleResult = await fetchAll(() =>
      supabase.from('articles').select('slug, updated_at, cover_image_url').eq('published', true).order('updated_at', { ascending: false }).order('slug')
    )
    if (articleResult.error) console.warn('[sitemap] could not fetch articles:', articleResult.error.message)
    else articles = articleResult.rows

    const copy = await supabase.from('category_descriptions').select('slug').eq('is_indexable', false)
    if (copy.error) console.warn('[sitemap] could not read category_descriptions:', copy.error.message)
    else for (const row of copy.data || []) hiddenCategories.add(row.slug)
  } else {
    console.warn('[sitemap] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — writing static-only sitemap.')
  }

  const moviesLastmod = newest(movies.map((m) => m.updated_at))
  const articlesLastmod = newest(articles.map((a) => a.updated_at))
  const written = {} // file -> newest lastmod it contains

  // ---- sitemap-pages.xml ----
  const pageLastmod = (r) => (r.lastmodFrom === 'movies' ? moviesLastmod : r.lastmodFrom === 'articles' ? articlesLastmod : undefined)
  // Weekly "new" archives (/new/2026-w41): only weeks with enough additions,
  // lastmod = the newest addition in that week.
  const weekLastmod = new Map()
  for (const m of movies) {
    const key = weekKey(m.created_at)
    if (key && (!weekLastmod.has(key) || day(m.created_at) > weekLastmod.get(key))) weekLastmod.set(key, day(m.created_at))
  }
  const weekPages = summarizeWeeks(movies.map((m) => m.created_at))
    .filter((w) => isIndexableWeek(w.count))
    .map((w) => ({ path: `/new/${w.key}`, lastmod: weekLastmod.get(w.key) }))
  writeFileSync(
    join(OUT_DIR, 'sitemap-pages.xml'),
    urlset([
      ...STATIC_ROUTES.map((r) => urlEntry(`${SITE_URL}${r.path}`, { changefreq: r.changefreq, priority: r.priority, lastmod: pageLastmod(r) })),
      ...weekPages.map((p) => urlEntry(`${SITE_URL}${p.path}`, { changefreq: 'monthly', priority: '0.4', lastmod: p.lastmod })),
    ])
  )
  written['sitemap-pages.xml'] = newest(STATIC_ROUTES.map(pageLastmod))

  // ---- sitemap-movies.xml (with poster <image:image>) ----
  writeFileSync(
    join(OUT_DIR, 'sitemap-movies.xml'),
    urlset(
      movies.map((m) =>
        urlEntry(`${SITE_URL}/movie/${m.slug}`, {
          changefreq: 'weekly',
          priority: '0.8',
          lastmod: day(m.updated_at),
          image: m.poster_url || undefined,
        })
      ),
      { image: true }
    )
  )
  written['sitemap-movies.xml'] = moviesLastmod

  // ---- sitemap-video.xml ----
  const videoEntries = []
  for (const m of movies) {
    const block = videoBlock(m)
    if (block) videoEntries.push(urlEntry(`${SITE_URL}/movie/${m.slug}`, { lastmod: day(m.updated_at), extra: block }))
  }
  writeFileSync(join(OUT_DIR, 'sitemap-video.xml'), urlset(videoEntries, { video: true }))
  written['sitemap-video.xml'] = moviesLastmod

  // ---- sitemap-articles.xml (with cover image) ----
  writeFileSync(
    join(OUT_DIR, 'sitemap-articles.xml'),
    urlset(
      articles.map((a) =>
        urlEntry(`${SITE_URL}/article/${a.slug}`, {
          changefreq: 'weekly',
          priority: '0.6',
          lastmod: day(a.updated_at),
          image: a.cover_image_url || undefined,
        })
      ),
      { image: true }
    )
  )
  written['sitemap-articles.xml'] = articlesLastmod

  // ---- sitemap-taxonomy.xml (indexable actors / channels / categories) ----
  const actorPages = indexableTaxonomy(movies, 'actors').map((p) => ({ ...p, path: `/actor/${p.slug}` }))
  const categoryPages = indexableTaxonomy(movies, 'tags').filter((p) => !hiddenCategories.has(p.slug)).map((p) => ({ ...p, path: `/category/${p.slug}` }))
  const channelPages = indexableTaxonomy(movies, 'channel', { single: true }).map((p) => ({ ...p, path: `/channel/${p.slug}` }))
  const taxonomyPages = [...actorPages, ...categoryPages, ...channelPages]
  writeFileSync(
    join(OUT_DIR, 'sitemap-taxonomy.xml'),
    urlset(taxonomyPages.map((p) => urlEntry(`${SITE_URL}${p.path}`, { changefreq: 'weekly', priority: '0.5', lastmod: p.lastmod })))
  )
  written['sitemap-taxonomy.xml'] = newest(taxonomyPages.map((p) => p.lastmod))

  // ---- sitemap.xml — the index that ties them all together ----
  const sitemapFiles = ['sitemap-pages.xml', 'sitemap-movies.xml', 'sitemap-video.xml', 'sitemap-articles.xml', 'sitemap-taxonomy.xml']
  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapFiles
    .map((f) => `  <sitemap>\n    <loc>${SITE_URL}/${f}</loc>${written[f] ? `\n    <lastmod>${written[f]}</lastmod>` : ''}\n  </sitemap>`)
    .join('\n')}\n</sitemapindex>\n`
  writeFileSync(join(OUT_DIR, 'sitemap.xml'), indexXml)

  const totalUrls = STATIC_ROUTES.length + weekPages.length + movies.length + articles.length + taxonomyPages.length
  console.log(
    `[sitemap] wrote sitemap.xml (index) + ${sitemapFiles.length} sub-sitemaps — ${totalUrls} URLs ` +
      `(${videoEntries.length} video entries; taxonomy: ${actorPages.length} actors, ${categoryPages.length} categories, ${channelPages.length} channels)`
  )

  // robots.txt lives in public/ and is edited by hand; only its Sitemap line
  // depends on SITE_URL, so that is the only thing refreshed here.
  const robotsPath = join('public', 'robots.txt')
  if (OUT_DIR === 'public' && existsSync(robotsPath)) {
    const robots = readFileSync(robotsPath, 'utf8')
    const updated = /^Sitemap:.*$/m.test(robots)
      ? robots.replace(/^Sitemap:.*$/m, `Sitemap: ${SITE_URL}/sitemap.xml`)
      : `${robots.replace(/\s*$/, '\n')}\nSitemap: ${SITE_URL}/sitemap.xml\n`
    if (updated !== robots) writeFileSync(robotsPath, updated)
    console.log('[sitemap] robots.txt kept; Sitemap line set to', `${SITE_URL}/sitemap.xml`)
  }
}

main().catch((err) => {
  console.error('[sitemap] generation failed:', err)
  // Never fail the whole Netlify build just because sitemap generation failed
  process.exit(0)
})
