// Runs after `vite build` (see package.json "build"). Renders every public
// URL to static HTML in dist/ — full page markup, per-page <title>/meta/
// canonical/Open Graph/JSON-LD in the <head>, and the data the page was
// rendered with embedded as window.__VEXN_PRELOAD__ so the browser
// hydrates the existing markup instead of re-fetching and re-rendering.
//
// Why: the site is a client-rendered SPA, so crawlers (and link previews
// on X/Telegram/Reddit) used to receive an empty <body> and the homepage
// title for every URL. Prerendering gives them real content without
// running a server.
//
// The plain SPA shell is kept as dist/app.html and serves everything that
// isn't prerendered (admin, search results, paginated pages, unknown
// slugs) via the fallback redirect in netlify.toml.

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { slugify } from '../src/lib/slugify.js'
import { buildTaxonomy, buildSingleTaxonomy } from '../src/lib/taxonomy.js'
import { MOVIE_CARD_FIELDS } from '../src/lib/movieFields.js'

const DIST = 'dist'
const SSR_DIR = 'dist-ssr'
const TAXONOMY_FIELDS = `${MOVIE_CARD_FIELDS},actors`
const MOVIES_PAGE_SIZE = 20
const ARTICLES_PAGE_SIZE = 20

// Netlify injects env vars; local builds read .env like Vite does.
function loadDotEnv() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

// Inline <script> data: `<` must not be able to close the script tag.
function serialize(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}

// Flat files (movie/foo.html) rather than directories (movie/foo/index.html):
// Netlify redirects a directory URL to its trailing-slash form, which would
// contradict the canonical URLs. Each page also gets an explicit rewrite in
// dist/_redirects so the clean URL serves the file on any host setting.
function outputPath(route) {
  return route === '/' ? join(DIST, 'index.html') : join(DIST, `${route}.html`)
}

function matchesSlug(movie, field, slug) {
  return (movie[field] || '').split(',').map((s) => s.trim()).some((v) => v && slugify(v) === slug)
}

function displayName(movie, field, slug) {
  return (movie[field] || '').split(',').map((s) => s.trim()).find((v) => slugify(v) === slug)
}

async function main() {
  loadDotEnv()
  const shellPath = join(DIST, 'index.html')
  if (!existsSync(shellPath)) throw new Error(`${shellPath} not found — run vite build first`)
  const shell = readFileSync(shellPath, 'utf8')
  writeFileSync(join(DIST, 'app.html'), shell)

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[prerender] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — skipping prerender.')
    return
  }

  const { render } = await import(pathToFileURL(resolve(SSR_DIR, 'entry-server.js')).href)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // The same queries the pages run in the browser, so the preloaded state
  // is what the client's own refresh would produce.
  const [cards, fullMovies, articles] = await Promise.all([
    supabase.from('movies').select(TAXONOMY_FIELDS).order('created_at', { ascending: false }),
    supabase.from('movies').select('*'),
    supabase.from('articles').select('*').eq('published', true).order('created_at', { ascending: false }),
  ])
  for (const r of [cards, fullMovies, articles]) if (r.error) throw new Error(`Supabase: ${r.error.message}`)
  const cardRows = cards.data || []
  const movieRows = fullMovies.data || []
  const articleRows = articles.data || []
  const stripActors = ({ actors, ...card }) => card

  const routes = []
  routes.push(['/', {
    featured: cardRows.filter((m) => m.featured).slice(0, 6).map(stripActors),
    latest: cardRows.slice(0, 12).map(stripActors),
    articles: articleRows.slice(0, 3).map(({ id, slug, title, excerpt, cover_image_url }) => ({ id, slug, title, excerpt, cover_image_url })),
  }])
  routes.push(['/movies', { movies: cardRows.slice(0, MOVIES_PAGE_SIZE).map(stripActors), total: cardRows.length }])
  routes.push(['/articles', { articles: articleRows.slice(0, ARTICLES_PAGE_SIZE), total: articleRows.length }])

  const taxonomies = [
    { field: 'actors', listPath: '/actors', basePath: '/actor', items: buildTaxonomy(cardRows, 'actors') },
    { field: 'tags', listPath: '/categories', basePath: '/category', items: buildTaxonomy(cardRows, 'tags') },
    { field: 'channel', listPath: '/channels', basePath: '/channel', items: buildSingleTaxonomy(cardRows, 'channel') },
  ]
  for (const { field, listPath, basePath, items } of taxonomies) {
    routes.push([listPath, { items }])
    for (const item of items) {
      const allMatches = cardRows.filter((m) => matchesSlug(m, field, item.slug))
      if (allMatches.length === 0) continue
      const name = displayName(allMatches[0], field, item.slug) || item.slug
      routes.push([`${basePath}/${item.slug}`, { allMatches, name }])
    }
  }

  for (const movie of movieRows) {
    if (!movie.slug) continue
    const firstTag = (movie.tags || '').split(',')[0]?.trim()
    const related = firstTag
      ? cardRows
          .filter((m) => m.id !== movie.id && (m.tags || '').toLowerCase().includes(firstTag.toLowerCase()))
          .slice(0, 4)
          .map(stripActors)
      : []
    routes.push([`/movie/${movie.slug}`, { movie, related }])
  }
  for (const article of articleRows) {
    if (article.slug) routes.push([`/article/${article.slug}`, { article }])
  }

  let written = 0
  const failed = []
  const rewrites = []
  for (const [route, data] of routes) {
    try {
      const { html, helmet } = await render(route, { path: route, data })
      const head = helmet
        ? [helmet.title, helmet.meta, helmet.link, helmet.script].map((h) => h.toString()).filter(Boolean).join('\n    ')
        : ''
      const page = shell
        .replace(/<title>[\s\S]*?<\/title>\s*/, '')
        .replace(/<meta name="description"[^>]*>\s*/, '')
        .replace('</head>', `${head}\n  </head>`)
        .replace(
          /<div id="root">\s*<\/div>/,
          `<div id="root">${html}</div>\n    <script>window.__VEXN_PRELOAD__=${serialize({ path: route, data })}</script>`
        )
      if (!page.includes('__VEXN_PRELOAD__')) throw new Error('root element not found in shell')
      const file = outputPath(route)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, page)
      if (route !== '/') rewrites.push(`${route}  ${route}.html  200`)
      written++
    } catch (err) {
      failed.push(route)
      console.warn(`[prerender] ${route}: ${err.message}`)
    }
  }
  writeFileSync(join(DIST, '_redirects'), rewrites.join('\n') + '\n')
  console.log(`[prerender] wrote ${written} pages${failed.length ? `, ${failed.length} failed` : ''}`)
  if (written === 0) throw new Error('no pages were prerendered')
}

main()
  .then(() => rmSync(SSR_DIR, { recursive: true, force: true }))
  .catch((err) => {
    console.error('[prerender] failed:', err)
    process.exit(1)
  })
