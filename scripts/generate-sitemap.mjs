// Runs before every build (see package.json "build" script).
// Pulls every movie + article slug from Supabase and writes a fresh
// set of sitemap files so Google always sees current URLs, including
// ones added via bulk CSV upload.
//
// Instead of one flat sitemap.xml, this writes a *sitemap index*
// (public/sitemap.xml) that points at separate files:
//   sitemap-pages.xml     static routes (home, /movies, /articles, ...)
//   sitemap-movies.xml    every movie, with <image:image> tags for posters
//   sitemap-articles.xml  every article, with cover image tags
//   sitemap-taxonomy.xml  every actor/channel/category page
//
// Why split it up: a single sitemap is capped at 50,000 URLs / 50MB by
// the sitemap spec, splitting by type keeps each file small and lets
// Search Console show per-type indexing stats (e.g. "movies: 480/500
// indexed" separately from "articles: 12/12 indexed"), which makes it
// much easier to spot problems in one content type without digging.

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'

const SITE_URL = (process.env.SITE_URL || 'https://vexn.org').replace(/\/$/, '')
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/movies', changefreq: 'daily', priority: '0.9' },
  { path: '/articles', changefreq: 'daily', priority: '0.7' },
  { path: '/actors', changefreq: 'weekly', priority: '0.6' },
  { path: '/channels', changefreq: 'weekly', priority: '0.6' },
  { path: '/categories', changefreq: 'weekly', priority: '0.6' },
]

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Splits a comma-separated field (actors/tags) across all movie rows
// into a unique, slugified list of { path } sitemap entries.
function commaFieldRoutes(rows, field, basePath) {
  const seen = new Set()
  for (const row of rows) {
    for (const name of (row[field] || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      seen.add(slugify(name))
    }
  }
  return [...seen].map((slug) => `${basePath}/${slug}`)
}

function urlEntry(loc, { changefreq, priority, lastmod, image }) {
  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : '',
    priority ? `    <priority>${priority}</priority>` : '',
    image ? `    <image:image><image:loc>${xmlEscape(image)}</image:loc></image:image>` : '',
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n')
}

function urlset(entries, { withImageNs = false } = {}) {
  const imageNs = withImageNs ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>\n${entries.join('\n')}\n</urlset>\n`
}

async function main() {
  mkdirSync('public', { recursive: true })

  let movies = []
  let articles = []

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { data: movieRows, error: movieErr } = await supabase
      .from('movies')
      .select('slug, updated_at, tags, actors, channel, poster_url')
      .order('updated_at', { ascending: false })
    if (movieErr) console.warn('[sitemap] could not fetch movies:', movieErr.message)
    else movies = movieRows || []

    const { data: articleRows, error: articleErr } = await supabase
      .from('articles')
      .select('slug, updated_at, cover_image_url')
      .eq('published', true)
      .order('updated_at', { ascending: false })
    if (articleErr) console.warn('[sitemap] could not fetch articles:', articleErr.message)
    else articles = articleRows || []
  } else {
    console.warn('[sitemap] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — writing static-only sitemap.')
  }

  const today = new Date().toISOString().slice(0, 10)

  // ---- sitemap-pages.xml ----
  const pagesXml = urlset(
    STATIC_ROUTES.map((r) =>
      urlEntry(`${SITE_URL}${r.path}`, { changefreq: r.changefreq, priority: r.priority, lastmod: today })
    )
  )
  writeFileSync('public/sitemap-pages.xml', pagesXml)

  // ---- sitemap-movies.xml (with poster <image:image>) ----
  const moviesXml = urlset(
    movies.map((m) =>
      urlEntry(`${SITE_URL}/movie/${m.slug}`, {
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: m.updated_at?.slice(0, 10),
        image: m.poster_url || undefined,
      })
    ),
    { withImageNs: true }
  )
  writeFileSync('public/sitemap-movies.xml', moviesXml)

  // ---- sitemap-articles.xml (with cover image) ----
  const articlesXml = urlset(
    articles.map((a) =>
      urlEntry(`${SITE_URL}/article/${a.slug}`, {
        changefreq: 'weekly',
        priority: '0.6',
        lastmod: a.updated_at?.slice(0, 10),
        image: a.cover_image_url || undefined,
      })
    ),
    { withImageNs: true }
  )
  writeFileSync('public/sitemap-articles.xml', articlesXml)

  // ---- sitemap-taxonomy.xml (actors / channels / categories) ----
  const actorRoutes = commaFieldRoutes(movies, 'actors', '/actor')
  const categoryRoutes = commaFieldRoutes(movies, 'tags', '/category')
  const channelRoutes = [...new Set(movies.map((m) => m.channel).filter(Boolean))].map(
    (c) => `/channel/${slugify(c)}`
  )
  const taxonomyXml = urlset(
    [...actorRoutes, ...categoryRoutes, ...channelRoutes].map((p) =>
      urlEntry(`${SITE_URL}${p}`, { changefreq: 'weekly', priority: '0.5' })
    )
  )
  writeFileSync('public/sitemap-taxonomy.xml', taxonomyXml)

  // ---- sitemap.xml — the index that ties them all together ----
  const sitemapFiles = ['sitemap-pages.xml', 'sitemap-movies.xml', 'sitemap-articles.xml', 'sitemap-taxonomy.xml']
  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapFiles
    .map((f) => `  <sitemap>\n    <loc>${SITE_URL}/${f}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`)
    .join('\n')}\n</sitemapindex>\n`
  writeFileSync('public/sitemap.xml', indexXml)

  const totalUrls = STATIC_ROUTES.length + movies.length + articles.length + actorRoutes.length + categoryRoutes.length + channelRoutes.length
  console.log(`[sitemap] wrote sitemap.xml (index) + 4 sub-sitemaps — ${totalUrls} URLs total`)

  const robots = `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${SITE_URL}/sitemap.xml
`
  writeFileSync('public/robots.txt', robots)
  console.log('[sitemap] wrote public/robots.txt')
}

main().catch((err) => {
  console.error('[sitemap] generation failed:', err)
  // Never fail the whole Netlify build just because sitemap generation failed
  process.exit(0)
})
