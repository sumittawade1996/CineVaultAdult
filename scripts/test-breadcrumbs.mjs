// node scripts/test-breadcrumbs.mjs
import assert from 'node:assert/strict'
import { movieCrumbs, breadcrumbJsonLd } from '../src/lib/breadcrumbs.js'

const movie = { title: 'Angela White - The Lucky Guy', slug: 'angela-white-the-lucky-guy' }
let n = 0
const check = (name, fn) => {
  try { fn(); console.log('  ok  ', name); n++ } catch (e) { console.log('  FAIL', name, '\n      ', e.message); process.exitCode = 1 }
}

check('uses the first topic tag, skipping attribute tags', () => {
  const crumbs = movieCrumbs(movie, ['HD', 'Pornstar', 'Big Tits', 'Brunette'])
  assert.deepEqual(crumbs.map((c) => c.name), ['Home', 'Big Tits', 'Angela White - The Lucky Guy'])
  assert.equal(crumbs[1].to, '/category/big-tits')
  assert.equal(crumbs[2].to, '/movie/angela-white-the-lucky-guy')
})
check('falls back to Movies when every tag is an attribute tag', () => {
  assert.equal(movieCrumbs(movie, ['HD', '4K']).at(1).to, '/movies')
})
check('falls back to Movies when there are no tags', () => {
  assert.equal(movieCrumbs(movie, []).at(1).name, 'Movies')
})
check('BreadcrumbList has absolute URLs and 1-based positions', () => {
  const ld = breadcrumbJsonLd(movieCrumbs(movie, ['Desi']))
  assert.equal(ld['@type'], 'BreadcrumbList')
  assert.deepEqual(ld.itemListElement.map((i) => i.position), [1, 2, 3])
  assert.equal(ld.itemListElement[0].item, 'https://vexn.org/')
  assert.equal(ld.itemListElement[1].item, 'https://vexn.org/category/desi')
})
console.log(`\n${n}/4 passed`)
