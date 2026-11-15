// node scripts/test-page-seo.mjs — page links (src/lib/seoUrl.js pageHref) and CollectionPage schema (src/lib/collectionJsonLd.js)
import assert from 'node:assert/strict'
import { pageHref } from '../src/lib/seoUrl.js'
import { MAX_LISTED, collectionJsonLd } from '../src/lib/collectionJsonLd.js'
import { PAGE_COPY_DEFAULTS, mergePageCopy } from '../src/lib/pageCopy.js'

const cases = [
  // page links keep the rest of the query; page 1 has no parameter
  () => assert.equal(pageHref('/category/milf', '', 2), '/category/milf?page=2'),
  () => assert.equal(pageHref('/category/milf', '?page=3', 1), '/category/milf'),
  () => assert.equal(pageHref('/movies', '?q=angela&page=2', 3), '/movies?q=angela&page=3'),
  () => assert.equal(pageHref('/movies', '?q=angela&page=2', 1), '/movies?q=angela'),
  // the schema: page, list, positions, absolute addresses
  () => {
    const ld = collectionJsonLd({ path: '/channel/brazzers', name: 'Brazzers', description: 'd', items: [{ to: '/movie/a', name: 'A' }, { to: '/movie/b', name: 'B' }], total: 58 })
    assert.equal(ld['@type'], 'CollectionPage')
    assert.equal(ld.url, 'https://vexn.org/channel/brazzers')
    assert.equal(ld.mainEntity.numberOfItems, 58)
    assert.deepEqual(ld.mainEntity.itemListElement[1], { '@type': 'ListItem', position: 2, url: 'https://vexn.org/movie/b', name: 'B' })
  },
  () => { // a video with a picture and a date is a VideoObject with its runtime
    const ld = collectionJsonLd({ path: '/category/jav', name: 'JAV', items: [{ to: '/movie/a', name: 'A', minutes: 119, thumbnail: 'https://img/a.jpg', uploadDate: '2026-10-01T00:00:00Z' }, { to: '/movie/b', name: 'B', minutes: 30 }] })
    assert.deepEqual(ld.mainEntity.itemListElement[0], { '@type': 'ListItem', position: 1, item: { '@type': 'VideoObject', '@id': 'https://vexn.org/movie/a', url: 'https://vexn.org/movie/a', name: 'A', thumbnailUrl: 'https://img/a.jpg', uploadDate: '2026-10-01T00:00:00Z', duration: 'PT119M' } })
    assert.deepEqual(ld.mainEntity.itemListElement[1], { '@type': 'ListItem', position: 2, url: 'https://vexn.org/movie/b', name: 'B' }) // no picture or date: a plain entry
  },
  // site pages: a database row overrides field by field; an empty field or no row keeps the built-in wording
  () => assert.deepEqual(mergePageCopy('categories', null), PAGE_COPY_DEFAULTS.categories),
  () => {
    const c = mergePageCopy('categories', { seo_title: 'Porn Categories From The Database', intro: '  ', heading: null })
    assert.equal(c.seo_title, 'Porn Categories From The Database')
    assert.equal(c.intro, PAGE_COPY_DEFAULTS.categories.intro)
    assert.equal(c.heading, 'Categories')
  },
  () => assert.deepEqual(Object.keys(PAGE_COPY_DEFAULTS), ['home', 'categories', 'channels', 'actors']),
  () => { // a long list is cut, the count stays the full one
    const items = Array.from({ length: 300 }, (_, i) => ({ to: `/actor/a${i}`, name: `A${i}` }))
    const ld = collectionJsonLd({ path: '/actors', name: 'Actors', items, total: 300 })
    assert.equal(ld.mainEntity.itemListElement.length, MAX_LISTED)
    assert.equal(ld.mainEntity.numberOfItems, 300)
    assert.equal(ld.description, undefined)
  },
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 4).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
