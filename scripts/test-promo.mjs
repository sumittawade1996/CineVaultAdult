// node scripts/test-promo.mjs
import assert from 'node:assert/strict'
import { buildUtm, xLength } from './promo/utm.mjs'
import { POSTS } from './promo/posts.mjs'
import { checkContent } from '../src/lib/contentRules.js'
import { composeWeekly } from './promo/weekly.mjs'
import { pickUrls, findKey } from './promo/indexnow.mjs'

const cases = [
  () => assert.equal(buildUtm('/category/indian', { source: 'x', campaign: 'evergreen-2026-11', content: 'wk1-sat' }),
    'https://vexn.org/category/indian?utm_source=x&utm_medium=social&utm_campaign=evergreen-2026-11&utm_content=wk1-sat'),
  () => assert.equal(buildUtm('https://vexn.org/new', { source: 'telegram', medium: 'channel', campaign: 'new-week' }), 'https://vexn.org/new?utm_source=telegram&utm_medium=channel&utm_campaign=new-week'),
  () => assert.equal(buildUtm('/new', { source: 'X Post', campaign: 'A B' }), 'https://vexn.org/new?utm_source=x-post&utm_medium=social&utm_campaign=a-b'), // values are cleaned
  () => assert.throws(() => buildUtm('https://evil.example/x', { source: 'x', campaign: 'c' })),
  () => assert.throws(() => buildUtm('/new', { source: 'x' })),

  // X length: links count 23, CJK and emoji count 2
  () => assert.equal(xLength('hello'), 5),
  () => assert.equal(xLength('see https://vexn.org/category/indian?utm_source=x&utm_medium=social now'), 4 + 23 + 4),
  () => assert.equal(xLength('你好'), 4),
  () => assert.equal(xLength('ok 🙂'), 3 + 2),

  // Telegram "new this week" message
  () => assert.equal(composeWeekly([]), null), // nothing added: nothing to post
  () => {
    const m = composeWeekly([{ tags: 'MILF, Big Tits, HD' }, { tags: 'MILF, Desi' }, { tags: 'Desi, Sneaky sex' }], new Date('2026-10-18T12:00:00Z'))
    assert.match(m.text, /^New on VEXN: 3 videos added in the last 7 days\./)
    assert.match(m.text, /Mostly Desi, MILF, Big Tits\./) // controlled tags only, most common first, ties alphabetical
    assert.ok(m.text.includes('https://vexn.org/new?utm_source=telegram&utm_medium=channel&utm_campaign=new-2026-w42'))
    assert.ok(m.text.trim().endsWith('18+ only.'))
  },
  () => assert.match(composeWeekly([{ tags: 'Sneaky sex' }]).text, /^New on VEXN: 1 video added/), // singular, and no "Mostly" line without a controlled tag
  () => assert.ok(!composeWeekly([{ tags: 'Sneaky sex' }]).text.includes('Mostly')),

  // IndexNow
  () => assert.deepEqual(pickUrls([{ loc: 'https://vexn.org/a', lastmod: '2026-10-18' }, { loc: 'https://vexn.org/a' }, { loc: 'https://other.example/b' }, { loc: 'not a url' }]), ['https://vexn.org/a']), // dedupe, own host only
  () => assert.deepEqual(pickUrls([{ loc: 'https://vexn.org/old', lastmod: '2026-09-01' }, { loc: 'https://vexn.org/new', lastmod: '2026-10-18T10:00:00Z' }, { loc: 'https://vexn.org/nodate' }], { since: '2026-10-01' }), ['https://vexn.org/new', 'https://vexn.org/nodate']),
  () => assert.match(findKey('public'), /^[a-f0-9]{32}$/), // the committed key file names itself

  // the post calendar itself
  () => assert.ok(POSTS.length >= 20),
  () => assert.equal(new Set(POSTS.map((p) => `${p.date} ${p.time}`)).size, POSTS.length), // no two posts in one slot
  () => assert.equal(new Set(POSTS.map((p) => p.text)).size, POSTS.length), // no repeated text
  () => assert.ok(POSTS.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && /^\d{2}:\d{2}$/.test(p.time) && p.path.startsWith('/'))),
  () => assert.ok(POSTS.every((p) => p.date > '2026-10-30')), // the X schedule already runs to 30 Oct
  () => assert.ok(POSTS.every((p) => xLength(`${p.text}\n\n${buildUtm(p.path, { source: 'x', campaign: 'evergreen-2026-11', content: 'c' })}`) <= 280)),
  () => assert.ok(POSTS.every((p) => { const t = p.tags.length; return t >= 1 && t <= 4 })),
  () => assert.ok(POSTS.every((p) => checkContent({ description: p.text }).block.length === 0)), // the content rules apply to posts too
]
let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 3).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
