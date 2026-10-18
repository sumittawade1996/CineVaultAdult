// node scripts/test-related.mjs
import assert from 'node:assert/strict'
import { candidateSpecs, pickRelated, relatedKeys, relatedScore, selectCandidates } from '../src/lib/related.js'

let n = 0
const row = (id, tags, actors, channel, day) => ({ id: `id-${id}`, title: id, tags, actors, channel, created_at: `2026-10-${String(day).padStart(2, '0')}T00:00:00Z` })

const movie = row('m', 'Big Tits, Brunette, HD, Pornstar', 'Angela White', 'VEXN', 10)
const rows = [
  movie,
  row('sameActor', 'Blonde', 'Angela White', 'VEXN', 1), // oldest, but the same performer
  row('twoTags', 'Big Tits, Brunette', null, 'VEXN', 9),
  row('oneTag', 'Big Tits', null, 'VEXN', 8),
  row('attrOnly', 'HD, Pornstar', null, 'VEXN', 7), // only attribute tags in common: unrelated
  row('chan', 'Anal', null, 'Brazzers', 6),
  row('none', 'Anal', null, 'VEXN', 5),
]

const cases = [
  // keys
  () => assert.deepEqual(relatedKeys(movie), { actors: ['angela-white'], tags: ['big-tits', 'brunette'], channel: null }),
  () => assert.equal(relatedKeys({ channel: 'Brazzers' }).channel, 'brazzers'),

  // score: a performer beats any number of tags
  () => assert.ok(relatedScore(relatedKeys(movie), rows[1]) > relatedScore(relatedKeys(movie), rows[2])),
  () => assert.equal(relatedScore(relatedKeys(movie), rows[4]), 0),

  // order: performer, then most shared tags, then fewer tags; ties by newest
  () => assert.deepEqual(pickRelated(movie, rows).map((r) => r.title), ['sameActor', 'twoTags', 'oneTag', 'attrOnly']),
  () => assert.ok(!pickRelated(movie, rows).some((r) => r.id === movie.id), 'never itself'),
  () => assert.equal(pickRelated(movie, rows, 2).length, 2),

  // a movie with nothing in common still gets the newest videos
  () => {
    const lonely = row('lonely', '', null, null, 11)
    const out = pickRelated(lonely, [lonely, ...rows.slice(1)])
    assert.equal(out.length, 4)
    assert.deepEqual(out.map((r) => r.title), ['twoTags', 'oneTag', 'attrOnly', 'chan'])
  },
  // fewer candidates than requested
  () => assert.equal(pickRelated(movie, [movie, rows[1]]).length, 1),

  // candidate selection: the performer set, the tag set and 8 newest, without the movie itself
  () => assert.deepEqual(candidateSpecs(movie).map((s) => [s.column, s.limit]), [['actors_slugs', 40], ['tags_slugs', 60], [null, 8]]),
  () => assert.deepEqual(candidateSpecs(row('x', '', null, null, 1)).map((s) => s.column), [null]),
  () => {
    const out = selectCandidates(movie, rows)
    assert.ok(!out.some((r) => r.id === movie.id))
    assert.ok(out.some((r) => r.title === 'sameActor'))
  },
  // a performer match older than the 40 newest tag matches is still found
  () => {
    const many = Array.from({ length: 100 }, (_, i) => row(`t${i}`, 'Big Tits', null, 'VEXN', 2 + (i % 20)))
    const all = [movie, row('oldActor', '', 'Angela White', 'VEXN', 1), ...many]
    assert.equal(pickRelated(movie, selectCandidates(movie, all))[0].title, 'oldActor')
  },
  // build-time and browser agree when timestamps tie (bulk imports): same ids in the same order
  () => {
    const tied = Array.from({ length: 30 }, (_, i) => ({ id: `id-${String(i).padStart(2, '0')}`, title: `r${i}`, tags: 'Big Tits', actors: null, channel: 'VEXN', created_at: '2026-10-05T00:00:00Z' }))
    const shuffled = [...tied].reverse()
    const a = pickRelated(movie, selectCandidates(movie, tied)).map((r) => r.id)
    const b = pickRelated(movie, selectCandidates(movie, shuffled)).map((r) => r.id)
    assert.deepEqual(a, b)
  },
]

let failed = 0
for (const run of cases) {
  n++
  try {
    run()
  } catch (err) {
    failed++
    console.log(`  FAIL #${n}: ${err.message.split('\n')[0]}`)
  }
}
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
