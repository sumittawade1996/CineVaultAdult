// Card images for link previews: /og-img/<id>/<width>/<height>/<n>.jpg returns the poster
// https://imggen.eporner.com/<id>/<width>/<height>/<n>.jpg unchanged, from our own domain.
//
// Why: X (Twitter) fetches a link's card image with a short timeout, and keeps an image-less card for about
// a week when that fetch fails. The posters used to be resized on the first request by Netlify's Image CDN
// (/.netlify/images), which took 1-10 seconds when nothing was cached yet, so many cards came out blank.
// This route passes the picture through (about 0.2-1 s) and the Netlify CDN caches the answer for a year.
//
// netlify/edge-functions/movie-gate.js builds these addresses. Only digits are accepted in the path and the
// host is fixed, so the route cannot be used to fetch anything else. If the poster cannot be fetched the
// request is sent on to the Image CDN route, as before.

const ORIGIN = 'https://imggen.eporner.com'
const SITE_URL = 'https://vexn.org'
const PATH = /^\/og-img\/(\d{1,10})\/(\d{2,4})\/(\d{2,4})\/(\d{1,3})\.jpg$/
const TIMEOUT_MS = 4000
const MAX_BYTES = 4 * 1024 * 1024 // X refuses card images over 5 MB

export default async (request) => {
  const m = new URL(request.url).pathname.match(PATH)
  if (!m || (request.method !== 'GET' && request.method !== 'HEAD')) return new Response('Not found', { status: 404 })
  const origin = `${ORIGIN}/${m[1]}/${m[2]}/${m[3]}/${m[4]}.jpg`
  try {
    const res = await fetch(origin, { headers: { accept: 'image/*' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    const type = res.headers.get('content-type') || ''
    const length = Number(res.headers.get('content-length') || 0)
    if (res.ok && type.startsWith('image/') && length <= MAX_BYTES) {
      return new Response(request.method === 'HEAD' ? null : res.body, {
        status: 200,
        headers: {
          'content-type': type,
          'cache-control': 'public, max-age=31536000, immutable',
          'netlify-cdn-cache-control': 'public, s-maxage=31536000, durable',
          'x-robots-tag': 'noindex', // a copy of another site's poster, not something to index
          ...(length ? { 'content-length': String(length) } : {}),
        },
      })
    }
  } catch { /* fall through to the Image CDN */ }
  return Response.redirect(`${SITE_URL}/.netlify/images?url=${encodeURIComponent(origin)}&w=1200&fm=jpg&q=80`, 302)
}

export const config = { path: '/og-img/*', cache: 'manual' }
