// Movie pages only get correct Open Graph/Twitter meta tags at build time
// (see scripts/prerender.mjs) — a movie added via Supabase after the last
// deploy falls through netlify.toml's catch-all to the generic app.html
// shell, so link previews on X/Telegram/Slack/Discord/WhatsApp show the
// site's default title/image instead of that movie's.
//
// Real visitors and SEO crawlers (Googlebot benefits from the fully
// prerendered page) are unaffected: this only intercepts requests whose
// User-Agent matches a known link-preview bot, fetches that one movie live
// from Supabase, and returns a minimal HTML document with the right meta
// tags — no rebuild required.

const BOT_UA = /Twitterbot|facebookexternalhit|Slackbot|Discordbot|WhatsApp|TelegramBot|LinkedInBot/i

const SITE_NAME = 'VEXN'
const SITE_URL = 'https://vexn.org'
const TWITTER_HANDLE = '@dezzymodel'

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default async (request) => {
  const ua = request.headers.get('user-agent') || ''
  if (!BOT_UA.test(ua)) return // not a known link-preview bot — serve the normal page

  const url = new URL(request.url)
  const slug = url.pathname.replace(/^\/movie\//, '').replace(/\/$/, '')
  if (!slug) return

  const SUPABASE_URL = Netlify.env.get('VITE_SUPABASE_URL')
  const SUPABASE_ANON_KEY = Netlify.env.get('VITE_SUPABASE_ANON_KEY')
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return // missing config — fall through to the normal page

  let movie
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/movies?slug=eq.${encodeURIComponent(slug)}&select=title,seo_title,seo_description,description,poster_url,trailer_url&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    )
    if (!res.ok) return
    ;[movie] = await res.json()
  } catch {
    return // Supabase unreachable — fall through rather than error the request
  }
  if (!movie) return // unknown slug — let the real 404 page handle it

  const title = movie.seo_title || movie.title
  const description = movie.seo_description || movie.description || `Watch ${movie.title} free on ${SITE_NAME}.`
  const image = posterUrl(movie)
  const canonical = `${SITE_URL}${url.pathname}`

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
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:site" content="${TWITTER_HANDLE}">
</head>
<body></body>
</html>
`

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export const config = { path: '/movie/*' }
