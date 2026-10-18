// node scripts/test-page-view.mjs — offline test of netlify/edge-functions/page-view.js
import assert from 'node:assert/strict'

const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36'
const env = { VITE_SUPABASE_URL: 'https://sb.test', VITE_SUPABASE_ANON_KEY: 'anon-key' }
globalThis.Netlify = { env: { get: (k) => env[k] } }

let inserted = []
let supabaseStatus = 201
globalThis.fetch = async (url, init) => {
  inserted.push({ url: String(url), headers: init.headers, row: JSON.parse(init.body) })
  return new Response(null, { status: supabaseStatus })
}

let n = 0
const load = () => import(`../netlify/edge-functions/page-view.js?case=${++n}`) // fresh module = fresh rate limiter
const post = (body, { ua = BROWSER, origin = 'https://vexn.org', method = 'POST', raw } = {}) =>
  new Request('https://vexn.org/api/pv', {
    method,
    headers: { 'user-agent': ua, origin, 'content-type': 'application/json' },
    body: method === 'POST' ? (raw ?? JSON.stringify(body)) : undefined,
  })
const ctx = (extra = {}) => ({ ip: '203.0.113.7', geo: { country: { code: 'IN' } }, ...extra })

const cases = []
const test = (name, fn) => cases.push([name, fn])

test('a valid view is stored with country and a browser visitor type', async () => {
  inserted = []
  const { default: handler } = await load()
  const res = await handler(post({ path: '/movie/x', referrer: 'https://t.co/abc', session_id: 's1', device: 'mobile', utm_source: 'x', utm_medium: 'social', utm_campaign: 'oct' }), ctx())
  assert.equal(res.status, 204)
  assert.equal(inserted.length, 1)
  assert.equal(inserted[0].url, 'https://sb.test/rest/v1/page_views')
  assert.deepEqual(inserted[0].row, {
    path: '/movie/x', referrer: 'https://t.co/abc', session_id: 's1', visitor_type: 'browser', country: 'IN',
    device: 'mobile', utm_source: 'x', utm_medium: 'social', utm_campaign: 'oct', status_code: null,
  })
  assert.equal(inserted[0].headers.apikey, 'anon-key')
})

test('the service role key is used when it is configured', async () => {
  inserted = []
  env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  const { default: handler } = await load()
  await handler(post({ path: '/' }), ctx())
  delete env.SUPABASE_SERVICE_ROLE_KEY
  assert.equal(inserted[0].headers.apikey, 'service-key')
})

test('a bot User-Agent is recorded as a bot', async () => {
  inserted = []
  const { default: handler } = await load()
  await handler(post({ path: '/' }, { ua: 'Mozilla/5.0 (compatible; AhrefsBot/7.0)' }), ctx())
  assert.equal(inserted[0].row.visitor_type, 'bot')
})

test('fields are trimmed and invalid values become null', async () => {
  inserted = []
  const { default: handler } = await load()
  await handler(post({ path: '/' + 'a'.repeat(400), referrer: 'r'.repeat(3000), device: 'toaster', utm_source: 'u'.repeat(300), status_code: 9999 }), ctx())
  const row = inserted[0].row
  assert.equal(row.path.length, 300)
  assert.equal(row.referrer.length, 2000)
  assert.equal(row.device, null)
  assert.equal(row.utm_source.length, 100)
  assert.equal(row.status_code, null)
})

test('a 404 status is kept', async () => {
  inserted = []
  const { default: handler } = await load()
  await handler(post({ path: '/movie/gone', status_code: 404 }), ctx())
  assert.equal(inserted[0].row.status_code, 404)
})

test('only POST is accepted', async () => {
  const { default: handler } = await load()
  const res = await handler(post(null, { method: 'GET' }), ctx())
  assert.equal(res.status, 405)
})

test('a foreign Origin is rejected', async () => {
  inserted = []
  const { default: handler } = await load()
  const res = await handler(post({ path: '/' }, { origin: 'https://evil.example' }), ctx())
  assert.equal(res.status, 403)
  assert.equal(inserted.length, 0)
})

test('bad input is rejected: invalid JSON, oversize body, path without a slash', async () => {
  const { default: handler } = await load()
  assert.equal((await handler(post(null, { raw: '{not json' }), ctx())).status, 400)
  assert.equal((await handler(post(null, { raw: JSON.stringify({ path: '/', pad: 'x'.repeat(5000) }) }), ctx())).status, 413)
  assert.equal((await handler(post({ path: 'no-slash' }), ctx())).status, 400)
})

test('rate limit: the 121st request from one IP in a minute gets 429', async () => {
  inserted = []
  const { default: handler } = await load()
  let last
  for (let i = 0; i < 121; i++) last = await handler(post({ path: '/' }), ctx())
  assert.equal(last.status, 429)
  assert.equal(inserted.length, 120)
})

test('bots get a much lower limit', async () => {
  const { default: handler } = await load()
  let last
  for (let i = 0; i < 11; i++) last = await handler(post({ path: '/' }, { ua: 'curl/8.0' }), ctx({ ip: '198.51.100.9' }))
  assert.equal(last.status, 429)
})

test('a Supabase failure answers 502, not a crash', async () => {
  supabaseStatus = 500
  const { default: handler } = await load()
  const res = await handler(post({ path: '/' }), ctx({ ip: '192.0.2.1' }))
  supabaseStatus = 201
  assert.equal(res.status, 502)
})

let failed = 0
for (const [name, fn] of cases) {
  try { await fn(); console.log('  ok  ', name) } catch (err) { failed++; console.log('  FAIL', name, '\n      ', err.message) }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
