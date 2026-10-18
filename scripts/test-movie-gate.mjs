// Offline test of netlify/edge-functions/movie-gate.js (no Netlify, no network).
//
//   node scripts/test-movie-gate.mjs
//
// Netlify's edge runtime is replaced by small mocks: a fake `Netlify.env`, a
// fake `fetch` standing in for Supabase and for /app.html, and a fake
// `context.next()` that returns either a prerendered page or the app shell.

import assert from 'node:assert/strict'

const PRERENDERED = '<html><body>page <script>window.__VEXN_PRELOAD__={}</script></body></html>'
const SHELL = '<html><body>SHELL</body></html>'
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36'
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const TWITTERBOT = 'Twitterbot/1.0'

const state = { removed: [], movies: [], down: false, calls: [] }

globalThis.Netlify = {
  env: { get: (k) => ({ VITE_SUPABASE_URL: 'https://sb.test', VITE_SUPABASE_ANON_KEY: 'anon' })[k] },
}
globalThis.fetch = async (input) => {
  const u = String(input)
  state.calls.push(u)
  if (u.endsWith('/app.html')) return new Response(SHELL, { headers: { 'content-type': 'text/html' } })
  if (state.down) throw new Error('supabase down')
  if (u.includes('/rest/v1/removed_movies')) return Response.json(state.removed)
  if (u.includes('/rest/v1/movies?')) {
    const slug = decodeURIComponent(u.match(/slug=eq\.([^&]+)/)[1])
    const hit = state.movies.find((m) => m.slug === slug)
    return Response.json(hit ? [hit] : [])
  }
  throw new Error('unexpected fetch ' + u)
}

let n = 0
async function run({ slug, ua = BROWSER, next = 'prerendered', removed = [], movies = [], down = false }) {
  Object.assign(state, { removed, movies, down, calls: [] })
  const mod = await import(`../netlify/edge-functions/movie-gate.js?case=${++n}`) // fresh module = empty cache
  const request = new Request(`https://vexn.org/movie/${slug}`, { headers: { 'user-agent': ua } })
  const context = {
    next: async () => {
      if (next === 'redirect') return new Response(null, { status: 301, headers: { location: '/movie/new-slug' } })
      return new Response(next === 'shell' ? SHELL : PRERENDERED, { status: 200, headers: { 'content-type': 'text/html' } })
    },
  }
  const res = await mod.default(request, context)
  return { res, text: res ? await res.clone().text() : null }
}

const cases = []
const test = (name, fn) => cases.push([name, fn])

test('live prerendered movie is served unchanged', async () => {
  const { res, text } = await run({ slug: 'live-one', movies: [{ slug: 'live-one' }] })
  assert.equal(res.status, 200)
  assert.ok(text.includes('__VEXN_PRELOAD__'))
  assert.equal(state.calls.filter((u) => u.includes('/rest/v1/movies?')).length, 0, 'no per-request movie lookup')
})

test('removed slug with no redirect answers 410 with the app shell and noindex', async () => {
  const { res, text } = await run({ slug: 'gone-a', removed: [{ slug: 'gone-a', redirect_to: null }] })
  assert.equal(res.status, 410)
  assert.equal(res.headers.get('x-robots-tag'), 'noindex')
  assert.equal(text, SHELL)
})

test('removed slug with redirect_to answers 301 to that path', async () => {
  const { res } = await run({ slug: 'moved-b', removed: [{ slug: 'moved-b', redirect_to: '/actor/lena-paul' }] })
  assert.equal(res.status, 301)
  assert.equal(res.headers.get('location'), 'https://vexn.org/actor/lena-paul')
})

test('a stale prerendered page of a removed movie is still answered with 410', async () => {
  const { res } = await run({ slug: 'gone-a', next: 'prerendered', removed: [{ slug: 'gone-a', redirect_to: null }] })
  assert.equal(res.status, 410)
})

test('redirect_to must be a same-site path (an external URL falls back to 410)', async () => {
  const { res } = await run({ slug: 'bad', removed: [{ slug: 'bad', redirect_to: 'https://evil.example/x' }] })
  assert.equal(res.status, 410)
})

test('unknown slug (shell fallback, not removed, not in movies) answers 404', async () => {
  const { res } = await run({ slug: 'never-existed', next: 'shell' })
  assert.equal(res.status, 404)
  assert.equal(res.headers.get('x-robots-tag'), 'noindex')
})

test('movie added after the last build (shell fallback, exists in movies) is served with 200', async () => {
  const { res, text } = await run({ slug: 'brand-new', next: 'shell', movies: [{ slug: 'brand-new' }] })
  assert.equal(res.status, 200)
  assert.equal(text, SHELL)
})

test('existing rename redirects from netlify.toml pass through untouched', async () => {
  const { res } = await run({ slug: 'old-name', next: 'redirect' })
  assert.equal(res.status, 301)
  assert.equal(res.headers.get('location'), '/movie/new-slug')
})

test('Googlebot gets the same status codes as browsers', async () => {
  const { res } = await run({ slug: 'gone-a', ua: GOOGLEBOT, removed: [{ slug: 'gone-a', redirect_to: null }] })
  assert.equal(res.status, 410)
})

test('link-preview bot gets live Open Graph tags for an existing movie', async () => {
  const movie = { slug: 'live-one', title: 'Live One', seo_title: 'Live One SEO', seo_description: 'desc', poster_url: 'https://imggen.eporner.com/1/1280/720/1.jpg' }
  const { res, text } = await run({ slug: 'live-one', ua: TWITTERBOT, next: 'shell', movies: [movie] })
  assert.equal(res.status, 200)
  assert.ok(text.includes('og:title') && text.includes('Live One SEO'))
  assert.ok(text.includes('/.netlify/images?url='), 'imggen poster is proxied through the Image CDN')
})

test('link-preview bot on a removed slug gets 410, not a preview', async () => {
  const { res } = await run({ slug: 'gone-a', ua: TWITTERBOT, removed: [{ slug: 'gone-a', redirect_to: null }] })
  assert.equal(res.status, 410)
})

test('Supabase down: prerendered page still served (fail open)', async () => {
  const { res, text } = await run({ slug: 'live-one', down: true })
  assert.equal(res.status, 200)
  assert.ok(text.includes('__VEXN_PRELOAD__'))
})

test('Supabase down: shell fallback is served with 200 rather than a wrong 404', async () => {
  const { res } = await run({ slug: 'brand-new', next: 'shell', down: true })
  assert.equal(res.status, 200)
})

test('removed list is cached: a second request does not refetch it', async () => {
  Object.assign(state, { removed: [{ slug: 'gone-a', redirect_to: null }], movies: [], down: false, calls: [] })
  const mod = await import(`../netlify/edge-functions/movie-gate.js?case=${++n}`)
  const req = (slug) => new Request(`https://vexn.org/movie/${slug}`, { headers: { 'user-agent': BROWSER } })
  const ctx = { next: async () => new Response(PRERENDERED, { status: 200, headers: { 'content-type': 'text/html' } }) }
  await mod.default(req('a'), ctx)
  await mod.default(req('b'), ctx)
  assert.equal(state.calls.filter((u) => u.includes('removed_movies')).length, 1)
})

let failed = 0
for (const [name, fn] of cases) {
  try {
    await fn()
    console.log('  ok  ', name)
  } catch (err) {
    failed++
    console.log('  FAIL', name, '\n      ', err.message)
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
