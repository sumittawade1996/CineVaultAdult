// Offline test of netlify/edge-functions/taxonomy-gate.js (no Netlify, no network).
//
//   node scripts/test-taxonomy-gate.mjs
//
// Same approach as test-movie-gate.mjs: a fake `Netlify.env`, a fake `fetch` standing in for Supabase
// and for /app.html, and a fake `context.next()` that returns a prerendered page, the shell or a redirect.
import assert from 'node:assert/strict'

const PRERENDERED = '<html><body>page <script>window.__VEXN_PRELOAD__={}</script></body></html>'
const SHELL = '<html><body>SHELL</body></html>'

const state = { known: {}, down: false, calls: [] }

globalThis.Netlify = {
  env: { get: (k) => ({ VITE_SUPABASE_URL: 'https://sb.test', VITE_SUPABASE_ANON_KEY: 'anon' })[k] },
}
globalThis.fetch = async (input) => {
  const u = String(input)
  state.calls.push(u)
  if (u.endsWith('/app.html')) return new Response(SHELL, { headers: { 'content-type': 'text/html' } })
  if (state.down) throw new Error('supabase down')
  // movies?actors_slugs=cs.%7Bslug%7D / movies?tags_slugs=... / movies?channel_slug=eq.slug / articles?slug=eq.slug&published=eq.true
  const m = u.match(/rest\/v1\/(movies|articles)\?(actors_slugs|tags_slugs|channel_slug|slug)=(?:cs\.%7B|eq\.)([^&%]+)/)
  if (!m) throw new Error('unexpected fetch ' + u)
  const hit = (state.known[m[2]] || []).includes(m[3])
  return Response.json(hit ? [{ slug: 'x' }] : [])
}

let n = 0
async function run({ path, next = 'shell', known = {}, down = false }) {
  Object.assign(state, { known, down, calls: [] })
  const mod = await import(`../netlify/edge-functions/taxonomy-gate.js?case=${++n}`)
  const request = new Request(`https://vexn.org${path}`)
  const context = {
    next: async () => {
      if (next === 'redirect') return new Response(null, { status: 301, headers: { location: '/article/new-slug' } })
      return new Response(next === 'prerendered' ? PRERENDERED : SHELL, { status: 200, headers: { 'content-type': 'text/html' } })
    },
  }
  const res = await mod.default(request, context)
  return { res, text: res ? await res.clone().text() : null }
}

const cases = []
const test = (name, fn) => cases.push([name, fn])
const lookups = () => state.calls.filter((u) => u.includes('/rest/v1/'))

test('a prerendered page is served unchanged with no database call', async () => {
  const { res, text } = await run({ path: '/actor/lena-paul', next: 'prerendered' })
  assert.equal(res.status, 200)
  assert.ok(text.includes('__VEXN_PRELOAD__'))
  assert.equal(lookups().length, 0)
})

test('an unknown performer answers 404 with the shell and noindex', async () => {
  const { res, text } = await run({ path: '/actor/nobody-here' })
  assert.equal(res.status, 404)
  assert.equal(res.headers.get('x-robots-tag'), 'noindex')
  assert.equal(text, SHELL)
})

test('a performer added since the last build (shell, but has videos) is served', async () => {
  const { res } = await run({ path: '/actor/new-star', known: { actors_slugs: ['new-star'] } })
  assert.equal(res.status, 200)
})

test('category, channel and article lookups use their own column', async () => {
  assert.equal((await run({ path: '/category/typo' })).res.status, 404)
  assert.ok(lookups()[0].includes('tags_slugs=cs.%7Btypo%7D'))
  assert.equal((await run({ path: '/channel/nope' })).res.status, 404)
  assert.ok(lookups()[0].includes('channel_slug=eq.nope'))
  assert.equal((await run({ path: '/article/old-post' })).res.status, 404)
  assert.ok(lookups()[0].includes('published=eq.true'), 'only a published article counts')
  assert.equal((await run({ path: '/article/live-post', known: { slug: ['live-post'] } })).res.status, 200)
  assert.equal((await run({ path: '/channel/vexn', known: { channel_slug: ['vexn'] } })).res.status, 200)
  assert.equal((await run({ path: '/category/milf', known: { tags_slugs: ['milf'] } })).res.status, 200)
})

test('extra path segments are a 404 without asking the database', async () => {
  const { res } = await run({ path: '/actor/lena-paul/extra' })
  assert.equal(res.status, 404)
  assert.equal(lookups().length, 0)
})

test('a slug with characters outside a-z, 0-9 and dashes is a 404 and never reaches the query', async () => {
  for (const bad of ['Lena-Paul', 'a%2Cb', 'x%7D%26select%3D*', '-lead', 'a--b']) {
    const { res } = await run({ path: `/actor/${bad}` })
    assert.equal(res.status, 404, bad)
    assert.equal(lookups().length, 0, bad)
  }
})

test('a redirect from netlify.toml is passed through untouched', async () => {
  const { res } = await run({ path: '/article/merged-guide', next: 'redirect' })
  assert.equal(res.status, 301)
  assert.equal(res.headers.get('location'), '/article/new-slug')
  assert.equal(lookups().length, 0)
})

test('Supabase down: the shell is served with 200 (fail open), not a wrong 404', async () => {
  const { res } = await run({ path: '/actor/someone', down: true })
  assert.equal(res.status, 200)
})

test('paths that are not ours are left to Netlify', async () => {
  const { res } = await run({ path: '/movies' })
  assert.equal(res, undefined)
})

let failed = 0
for (const [name, fn] of cases) {
  try { await fn(); console.log(`  ok   ${name}`) } catch (err) { failed++; console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').slice(0, 3).join(' | ')}`) }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
