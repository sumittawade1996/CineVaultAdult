// node scripts/test-seo-url.mjs
import assert from 'node:assert/strict'
import { analyzeSearch } from '../src/lib/seoUrl.js'

const cases = [
  ['', '', false],
  ['?page=1', '', false],
  ['?page=0', '', false],
  ['?page=2', '?page=2', false], // pagination: canonical to itself, still not a "variant"
  ['?utm_source=x&utm_medium=social&utm_campaign=oct', '', false], // tracking only: clean canonical, indexable
  ['?utm_source=x&page=3', '?page=3', false],
  ['?s=20&t=abc', '', false], // X share parameters
  ['?fbclid=1&gclid=2', '', false],
  ['?sort=title', '?sort=title', true],
  ['?q=desi', '?q=desi', true],
  ['?q=desi&page=2&utm_source=x', '?page=2&q=desi', true], // sorted, tracking removed
  ['?sort=title&q=desi', '?q=desi&sort=title', true], // stable order
  ['?page=2&page=3', '?page=3', false],
]

let failed = 0
for (const [input, expectedSearch, expectedVariant] of cases) {
  const got = analyzeSearch(input)
  try {
    assert.equal(got.search, expectedSearch)
    assert.equal(got.variant, expectedVariant)
    console.log('  ok  ', JSON.stringify(input), '->', JSON.stringify(got.search), got.variant ? '(variant: noindex)' : '')
  } catch (err) {
    failed++
    console.log('  FAIL', JSON.stringify(input), 'got', JSON.stringify(got), '\n      ', err.message)
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
