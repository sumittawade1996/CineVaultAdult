// node scripts/test-indexing.mjs
import assert from 'node:assert/strict'
import { isHeldMovie, isIndexableTaxonomy, isIndexableWeek } from '../src/lib/indexing.js'

const cases = [
  // [field, slug, count, expected, why]
  ['tags', 'indian', 122, true, 'topic category with enough titles'],
  ['tags', 'mature', 31, true, 'topic category'],
  ['tags', 'indian', 9, false, 'categories need 10 titles'],
  ['tags', 'indian', 10, true, '10 is enough'],
  ['tags', 'hd', 373, false, 'attribute tag'],
  ['tags', '4k', 57, false, 'attribute tag'],
  ['tags', 'pornstar', 302, false, 'attribute tag'],
  ['tags', 'web-series', 58, false, 'attribute tag (plan T10)'],
  ['tags', 'brazzers', 33, false, 'studio label tag duplicates the channel page'],
  ['actors', 'lena-paul', 22, true, 'performer with enough titles'],
  ['actors', 'peta-jensen', 2, false, 'performers need 5 titles'],
  ['actors', 'x', 5, true, '5 is enough'],
  ['channel', 'brazzers', 36, true, 'editorial channel'],
  ['channel', 'vexn', 746, false, 'catch-all channel for videos with no studio or app, not a topic'],
  ['tags', 'ullu', 12, false, 'app label (LABEL_TAGS), even when large'],
  ['tags', 'uncut', 40, false, 'format label (LABEL_TAGS)'],
  ['tags', 'web-series-2026', 30, false, 'label variant'],
  ['tags', 'housewife', 20, false, 'alias of Housewives: redirects, never indexed itself'],
  ['tags', 'outdoor', 29, true, 'free tag, big enough'],
  ['tags', 'outdoor', 9, false, 'free tag, too small'],
  ['channel', 'vixen', 9, true, 'studio channel'],
  ['channel', 'youtube', 1, false, 'channels need 3 titles'],
  ['channel', 'comatozze', 10, true, 'editorial channel'],
]

let failed = 0
for (const [field, slug, count, expected, why] of cases) {
  const got = isIndexableTaxonomy(field, slug, count)
  if (got === expected) console.log('  ok  ', field, slug, count, '->', got, `(${why})`)
  else {
    failed++
    console.log('  FAIL', field, slug, count, 'expected', expected, 'got', got, `(${why})`)
  }
}
for (const [count, expected] of [[430, true], [5, true], [4, false], [1, false], [0, false]]) {
  if (isIndexableWeek(count) === expected) console.log('  ok  ', 'week', count, '->', expected)
  else {
    failed++
    console.log('  FAIL', 'week', count, 'expected', expected)
  }
}
// held videos (blocked theme) stay out of the index and the sitemaps
for (const [movie, expected, why] of [
  [{ slug: 'a', title: 'Hot MILF Scene', tags: 'MILF', description: 'A short scene.' }, false, 'ordinary video'],
  [{ slug: 'virgin-girlfriend-first-time-sex', title: 'First time', tags: '' }, true, 'blocked word in the address'],
  [{ slug: 'b', title: 'Marathi MMS clip', tags: 'Desi' }, true, 'blocked word in the title'],
  [{ slug: 'c', title: 'Teacher visit', tags: 'Roleplay' }, false, 'review-level words are not held'],
]) {
  if (isHeldMovie(movie) === expected) console.log('  ok  ', 'held?', movie.slug, '->', expected, `(${why})`)
  else { failed++; console.log('  FAIL', 'held?', movie.slug, 'expected', expected, `(${why})`) }
}
console.log(`\n${cases.length + 9 - failed}/${cases.length + 9} passed`)
process.exit(failed ? 1 : 0)
