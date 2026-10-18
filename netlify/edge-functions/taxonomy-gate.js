// Correct status codes for performer, category, channel and article URLs that do not exist.
//
// Without this an unknown slug (/actor/nobody, /category/typo, /article/old-post) fell through to
// the app shell and answered HTTP 200 with the site's "not found" screen: a soft 404 that search
// engines keep crawling. The same job movie-gate.js does for /movie/*.
//
//   - prerendered page (the build wrote it)         -> served as before, no database call
//   - fallback shell and the slug exists            -> served as before (a page added since the last build)
//   - fallback shell and the slug does not exist    -> 404 with the app shell and `X-Robots-Tag: noindex`
//   - a path with extra segments (/actor/a/b)       -> 404
//
// Fail-open: if Supabase cannot be reached the page is served exactly as before. Redirects from
// netlify.toml still win, because context.next() answers them (301) before this function looks at the body.
import { statusPage, supabaseGet } from './lib/gate-common.js'

// route prefix -> how to ask Supabase whether the slug has anything on it
const LOOKUPS = {
  actor: (slug) => `movies?actors_slugs=cs.%7B${slug}%7D&select=slug&limit=1`,
  category: (slug) => `movies?tags_slugs=cs.%7B${slug}%7D&select=slug&limit=1`,
  channel: (slug) => `movies?channel_slug=eq.${slug}&select=slug&limit=1`,
  article: (slug) => `articles?slug=eq.${slug}&published=eq.true&select=slug&limit=1`,
}
// Slugs are lower-case letters, digits and dashes (src/lib/slugify.js). Anything else cannot exist,
// and keeping the filter to this alphabet means a request cannot alter the query.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// true / false, or null when it could not be determined.
async function slugExists(env, kind, slug) {
  try {
    const res = await supabaseGet(env, LOOKUPS[kind](slug))
    if (!res.ok) return null
    return (await res.json()).length > 0
  } catch {
    return null
  }
}

export default async (request, context) => {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean) // ['actor', 'lena-paul']
  const kind = parts[0]
  if (!LOOKUPS[kind]) return // not one of ours

  const supabaseUrl = Netlify.env.get('VITE_SUPABASE_URL')
  const supabaseKey = Netlify.env.get('VITE_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseKey) return context.next() // missing config: behave as before

  const response = await context.next()
  const type = response.headers.get('content-type') || ''
  if (response.status !== 200 || !type.includes('text/html')) return response // redirects, assets, errors

  const body = await response.text()
  const keep = () => new Response(body, { status: response.status, headers: response.headers })
  if (body.includes('__VEXN_PRELOAD__')) return keep() // prerendered, so the slug existed at build time

  if (parts.length !== 2) return statusPage(request, 404)
  let slug = parts[1]
  try { slug = decodeURIComponent(slug) } catch { /* keep the raw value */ }
  if (!SLUG.test(slug)) return statusPage(request, 404)

  const exists = await slugExists({ url: supabaseUrl, key: supabaseKey }, kind, slug)
  if (exists === false) return statusPage(request, 404)
  return keep()
}

export const config = { path: ['/actor/*', '/category/*', '/channel/*', '/article/*'] }
