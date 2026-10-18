// node scripts/test-taxonomy-facts.mjs
import assert from 'node:assert/strict'
import { pickRail, summarizeMatches } from '../src/lib/taxonomyFacts.js'

const v = (slug, mins, extra = {}) => ({ slug, title: `Title ${slug}`, runtime_minutes: mins, channel: null, source: 'Eporner', actors: '', ...extra })

const cases = [
  () => assert.equal(summarizeMatches([v('a', 10), v('b', 20)]), null), // too few titles
  () => assert.equal(summarizeMatches(null), null),
  () => {
    const f = summarizeMatches([v('a', 10), v('b', 30), v('c', 50), v('d', null)])
    assert.deepEqual(f.runtime, { known: 3, min: 10, max: 50, avg: 30, over30: 2 }) // unknown runtimes are left out
    assert.equal(f.count, 4)
  },
  () => assert.equal(summarizeMatches([v('a', null), v('b', null), v('c', null)]).runtime, null),
  () => {
    const f = summarizeMatches([v('a', 10, { channel: 'Brazzers' }), v('b', 20, { channel: 'Brazzers' }), v('c', 30, { channel: 'Nuru Massage' }), v('d', 40)])
    assert.deepEqual(f.channels, [{ name: 'Brazzers', count: 2 }, { name: 'Nuru Massage', count: 1 }])
    assert.deepEqual(f.sources, [{ name: 'Eporner', count: 4 }])
  },
  () => {
    const f = summarizeMatches([v('a', 10), v('b', 70), v('c', 50), v('d', 60), v('e', 5)])
    assert.deepEqual(f.longest.map((l) => [l.slug, l.minutes]), [['b', 70], ['d', 60], ['c', 50]])
  },
  () => {
    const f = summarizeMatches([v('a', 10, { slug: 'x' }), v('b', 10, { slug: 'a' })].concat([v('c', 10)]))
    assert.deepEqual(f.longest.map((l) => l.slug), ['a', 'c', 'x']) // ties break by slug, so the order is stable
  },
  () => {
    const rows = [
      v('a', 10, { actors: 'Dani Daniels, Anikka Albrite' }),
      v('b', 10, { actors: 'Dani Daniels, Anikka Albrite, Dana Vespoli' }),
      v('c', 10, { actors: 'Dani Daniels' }),
    ]
    const f = summarizeMatches(rows, { ownSlug: 'dani-daniels' })
    assert.deepEqual(f.coStars.map((p) => [p.slug, p.count]), [['anikka-albrite', 2]]) // themselves and one-off names are left out
  },
  () => {
    const rows = [v('a', 10, { actors: 'A One, B Two' }), v('b', 10, { actors: 'A One, B Two' }), v('c', 10, { actors: 'A One' })]
    assert.deepEqual(summarizeMatches(rows).coStars.map((p) => p.slug), ['a-one', 'b-two']) // channel page: nobody excluded
  },
  // desktop side rail picks
  () => {
    const p = (slug, mins, extra = {}) => v(slug, mins, { poster_url: `https://img/${slug}.jpg`, ...extra })
    const rows = [p('a', 10), p('b', 70), p('c', 50, { featured: true }), p('d', 60, { featured: true }), p('e', 5)]
    assert.deepEqual(pickRail(rows, 2).map((m) => m.slug), ['d', 'c']) // featured first, longest first within a group
    assert.deepEqual(pickRail(rows, 3).map((m) => m.slug), ['d', 'c', 'b']) // then the longest of the rest
    assert.deepEqual(pickRail(rows, 0), [])
  },
  () => {
    const rows = [v('a', 90, { poster_url: null }), v('b', 40, { poster_url: 'x' }), v('c', 30, { poster_url: 'x' }), v('d', 20, { poster_url: 'x' })]
    assert.deepEqual(pickRail(rows, 2).map((m) => m.slug), ['b', 'c']) // a row without a poster is skipped
    assert.deepEqual(pickRail(rows.slice(0, 3), 2), []) // under four titles the grid already shows everything
    assert.deepEqual(pickRail(null, 2), [])
  },
  () => {
    const rows = [v('a', 10, { x: 1 }), v('b', 20), v('c', 30), v('d', 40)]
    assert.deepEqual(pickRail(rows, 2, (m) => m.slug !== 'd').map((m) => m.slug), ['c', 'b']) // the caller decides what counts as a poster
  },
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 3).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
