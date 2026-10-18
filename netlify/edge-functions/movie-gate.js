// Edge function for every /movie/<slug> request. It does two jobs.
//
// 1. Link previews. Movie pages only get correct Open Graph/Twitter meta tags
//    at build time (see scripts/prerender.mjs) — a movie added via Supabase
//    after the last deploy falls through netlify.toml's catch-all to the
//    generic app.html shell, so link previews on X/Telegram/Slack/Discord/
//    WhatsApp would show the site's default title/image instead of that
//    movie's. For known link-preview bots this fetches the movie live from
//    Supabase and returns a minimal HTML document with the right meta tags —
//    no rebuild required.
//
// 2. Correct status codes for missing movies (plan task T3). Without this a
//    removed or unknown slug fell through to the app shell and answered
//    HTTP 200 (a "soft 404"), which search engines keep indexing.
//      - slug listed in public.removed_movies with redirect_to -> 301 there
//      - slug listed in public.removed_movies                  -> 410 Gone
//      - slug not in public.movies and not listed              -> 404
//      - everything else                                       -> served as before
//    The 404/410 body is the normal app shell, so visitors see the site's
//    "not found" page; the response carries `X-Robots-Tag: noindex`.
//
// Fail-open: if Supabase is unreachable the page is served exactly as it was
// before this function existed. Prerendered pages for live movies cost no
// per-request database call (the removed list is cached in memory).

import { supabaseGet, statusPage } from './lib/gate-common.js'

const BOT_UA = /Twitterbot|facebookexternalhit|Slackbot|Discordbot|WhatsApp|TelegramBot|LinkedInBot/i

const SITE_NAME = 'VEXN'
const SITE_URL = 'https://vexn.org'
// Share image for movies that have no poster of their own (public/og-default.png).
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`
const TWITTER_HANDLE = '@dezzymodel'

const REMOVED_TTL_MS = 5 * 60 * 1000
const PAGE = 1000 // PostgREST returns at most this many rows per request

// Per-isolate cache of public.removed_movies: Map(slug -> redirect_to|null).
let removedCache = { at: 0, map: null }
let removedFailedAt = 0 // last failed load, so an outage does not add a timeout to every request
const RETRY_AFTER_FAILURE_MS = 30 * 1000

function youtubeId(url) {
  if (!url) return null
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/)
  if (m) return m[1]
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null
}

function posterUrl(movie) {
  if (movie.poster_url) return movie.poster_url
  const yt = youtubeId(movie.trailer_url)
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null
}

// imggen.eporner.com posters (1920x1080 originals) showed up as a blank,
// image-less link card in X's composer even though the file itself loads
// fine from a normal client. Serving them through Netlify's Image CDN (a
// resized JPEG on our own domain) sidesteps whatever X's fetcher trips on.
// Other poster hosts rendered fine and are left untouched.
function cardImage(url) {
  if (url && /^https:\/\/imggen\.eporner\.com\//.test(url)) {
    return `${SITE_URL}/.netlify/images?url=${encodeURIComponent(url)}&w=1200&fm=jpg&q=80`
  }
  return url
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slugFromPath(pathname) {
  let slug = pathname.replace(/^\/movie\//, '').replace(/\/$/, '')
  try { slug = decodeURIComponent(slug) } catch { /* keep the raw value */ }
  return slug
}

// Map(slug -> redirect_to|null) of removed movies, cached. Returns null when
// the list cannot be read at all (callers then fail open).
async function getRemoved(env) {
  const now = Date.now()
  if (removedCache.map && now - removedCache.at < REMOVED_TTL_MS) return removedCache.map
  if (now - removedFailedAt < RETRY_AFTER_FAILURE_MS) return removedCache.map
  try {
    const map = new Map()
    for (let from = 0; ; from += PAGE) {
      const res = await supabaseGet(env, 'removed_movies?select=slug,redirect_to&order=slug', {
        Range: `${from}-${from + PAGE - 1}`,
        'Range-Unit': 'items',
      })
      if (!res.ok) throw new Error(`removed_movies ${res.status}`)
      const rows = await res.json()
      for (const r of rows) map.set(r.slug, r.redirect_to || null)
      if (rows.length < PAGE) break
    }
    removedCache = { at: now, map }
    return map
  } catch {
    // Keep serving a stale list rather than nothing; otherwise fail open.
    removedFailedAt = now
    return removedCache.map
  }
}

// true / false, or null when it could not be determined.
async function movieExists(env, slug) {
  try {
    const res = await supabaseGet(env, `movies?slug=eq.${encodeURIComponent(slug)}&select=slug&limit=1`)
    if (!res.ok) return null
    const rows = await res.json()
    return rows.length > 0
  } catch {
    return null
  }
}

function redirectTo(request, target) {
  // Same-site paths only (the table also enforces this).
  if (typeof target !== 'string' || !/^\/[^/]/.test(target)) return null
  return new Response(null, {
    status: 301,
    headers: { location: new URL(target, request.url).toString(), 'cache-control': 'public, max-age=3600' },
  })
}

function previewResponse(movie, pathname) {
  const title = movie.seo_title || movie.title
  const description = movie.seo_description || movie.description || `Watch ${movie.title} free on ${SITE_NAME}.`
  const image = cardImage(posterUrl(movie)) || DEFAULT_OG_IMAGE
  const canonical = `${SITE_URL}${pathname}`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)} | ${SITE_NAME}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="video.movie">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escapeHtml(title)} | ${SITE_NAME}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="${TWITTER_HANDLE}">
</head>
<body></body>
</html>
`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export default async (request, context) => {
  const url = new URL(request.url)
  const slug = slugFromPath(url.pathname)
  if (!slug) return

  const supabaseUrl = Netlify.env.get('VITE_SUPABASE_URL')
  const supabaseKey = Netlify.env.get('VITE_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseKey) return context.next() // missing config — behave as before
  const env = { url: supabaseUrl, key: supabaseKey }

  const removed = await getRemoved(env) // Map or null
  if (removed && removed.has(slug)) {
    return redirectTo(request, removed.get(slug)) || statusPage(request, 410)
  }

  // Link-preview bots get live Open Graph tags for movies that exist.
  if (BOT_UA.test(request.headers.get('user-agent') || '')) {
    try {
      const res = await supabaseGet(
        env,
        `movies?slug=eq.${encodeURIComponent(slug)}&select=title,seo_title,seo_description,description,poster_url,trailer_url&limit=1`
      )
      if (res.ok) {
        const [movie] = await res.json()
        if (movie) return previewResponse(movie, url.pathname)
      }
    } catch { /* fall through to the normal page */ }
  }

  const response = await context.next()
  const type = response.headers.get('content-type') || ''
  if (response.status !== 200 || !type.includes('text/html')) return response // redirects, assets, errors

  const body = await response.text()
  const keep = () => new Response(body, { status: response.status, headers: response.headers })
  // Prerendered movie pages embed their data; the plain shell does not.
  if (body.includes('__VEXN_PRELOAD__')) return keep()

  // Fallback shell: fine for a movie added after the last build, wrong for a
  // slug that does not exist.
  const exists = await movieExists(env, slug)
  if (exists === false) return statusPage(request, 404)
  return keep()
}

export const config = { path: '/movie/*' }
