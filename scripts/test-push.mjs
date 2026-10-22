// node scripts/test-push.mjs
import assert from 'node:assert/strict'
import { WINDOW_HOURS, buildPayload, isGone, readConfig, shouldSend, toSubscription } from './lib/pushDigest.mjs'
import { keyToBytes } from '../src/lib/pushKey.js'
import { shouldPrompt } from '../src/lib/pushPolicy.js'
import { readFileSync } from 'node:fs'

const cases = [
  // the digest
  () => assert.equal(shouldSend(0), false),
  () => assert.equal(shouldSend(1), true),
  () => assert.equal(shouldSend(Number('')), false), // an unreadable count sends nothing
  () => assert.equal(WINDOW_HOURS, 24),
  () => assert.deepEqual(buildPayload(1), { title: 'VEXN', body: 'A new video was added today.', url: '/new' }),
  () => assert.deepEqual(buildPayload(87), { title: 'VEXN', body: 'New videos were added today.', url: '/new' }),
  // neutral: no title of any video, no adult words, no claims, in any payload
  () => { for (const n of [1, 2, 50]) assert.ok(!/porn|sex|hd|free|best|xxx|milf/i.test(JSON.stringify(buildPayload(n)))) },
  // when the soft prompt may appear
  () => assert.equal(shouldPrompt({ visits: 1, ageOk: true }), false), // never on a first visit
  () => assert.equal(shouldPrompt({ visits: 2, ageOk: true }), true),
  () => assert.equal(shouldPrompt({ visits: 1, standalone: true, ageOk: true }), true), // the installed app at once
  () => assert.equal(shouldPrompt({ visits: 5, ageOk: false }), false), // not over the 18+ screen
  () => assert.equal(shouldPrompt({ visits: 5, ageOk: true, optedOut: true }), false), // turned off by the visitor: never again
  () => assert.equal(shouldPrompt({ visits: 5, ageOk: true, dismissedAt: 1000, now: 1000 + 13 * 86400000 }), false), // "Not now" lasts 14 days
  () => assert.equal(shouldPrompt({ visits: 5, ageOk: true, dismissedAt: 1000, now: 1000 + 15 * 86400000 }), true),
  // push service answers
  () => assert.equal(isGone({ statusCode: 410 }), true),
  () => assert.equal(isGone({ statusCode: 404 }), true),
  () => assert.equal(isGone({ statusCode: 500 }), false),
  () => assert.equal(isGone(null), false),
  () => assert.deepEqual(toSubscription({ id: 'x', endpoint: 'https://push.example/1', p256dh: 'AAA', auth: 'BBB' }), { endpoint: 'https://push.example/1', keys: { p256dh: 'AAA', auth: 'BBB' } }),
  // settings
  () => assert.deepEqual(readConfig({}).missing, ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']),
  () => assert.deepEqual(readConfig({ VITE_SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 's', VITE_VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'k' }).missing, []),
  () => assert.equal(readConfig({ VAPID_PUBLIC_KEY: 'p' }).subject, 'https://vexn.org'),
  // the browser wants the public key as bytes: URL-safe base64, 65 bytes for a P-256 key
  () => { const bytes = keyToBytes('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBsr2iz6w8XqjPWQ5xgtG6wtE'); assert.equal(bytes.length, 65); assert.equal(bytes[0], 4) },
  // the service worker: neutral defaults, same-site click targets only
  () => {
    const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
    assert.match(sw, /addEventListener\('push'/)
    assert.match(sw, /addEventListener\('notificationclick'/)
    assert.match(sw, /\^\\\/\[\^\/\]/, 'only same-site paths are accepted as the click target')
  },
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 4).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
