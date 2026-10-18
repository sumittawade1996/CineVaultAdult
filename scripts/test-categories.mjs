// node scripts/test-categories.mjs
import assert from 'node:assert/strict'
import { CONTROLLED_CATEGORIES, CONTROLLED_NAMES, CONTROLLED_BY_SLUG, LABEL_TAGS, TAG_ALIASES, classifyTag, normalizeTags } from '../src/lib/categories.js'
import { CATEGORIES } from './data/category-descriptions.mjs'
import { ATTRIBUTE_TAGS } from '../src/lib/indexing.js'

const cases = [
  // the list itself
  () => assert.equal(CONTROLLED_NAMES.length, 55),
  () => assert.equal(new Set(CONTROLLED_NAMES.map((n) => n.toLowerCase())).size, 55), // no duplicates
  () => assert.ok(Object.keys(CONTROLLED_CATEGORIES).length >= 5),
  () => assert.ok([...CONTROLLED_BY_SLUG.keys()].every((s) => !LABEL_TAGS.has(s) && !TAG_ALIASES.has(s))), // no overlap between the three sets
  () => assert.ok([...TAG_ALIASES.values()].every((to) => CONTROLLED_BY_SLUG.has(to.toLowerCase().replace(/\s+/g, '-')) || LABEL_TAGS.has(to.toLowerCase().replace(/\s+/g, '-')) || to === 'Kissing')),
  // every hub page written for T12 is a controlled category (web-series is a label, kept out of the index)
  () => assert.deepEqual(CATEGORIES.map((c) => c.slug).filter((s) => !CONTROLLED_BY_SLUG.has(s)), ['web-series']),
  // the sitemap's attribute tags are all labels here too
  () => assert.deepEqual([...ATTRIBUTE_TAGS].filter((s) => !LABEL_TAGS.has(s)), []),

  // classification
  () => assert.equal(classifyTag('Big Tits'), 'controlled'),
  () => assert.equal(classifyTag('big tits'), 'controlled'),
  () => assert.equal(classifyTag('HD'), 'label'),
  () => assert.equal(classifyTag('ULLU'), 'label'),
  () => assert.equal(classifyTag('Housewife'), 'alias'),
  () => assert.equal(classifyTag('Sneaky sex'), 'free'),

  // normalisation
  () => assert.deepEqual(normalizeTags('Housewife, Romance, big tits, Big Tits').tags, 'Housewives, Romantic, Big Tits'),
  () => assert.deepEqual(normalizeTags('Housewife, Romance, big tits, Big Tits').changes.map((c) => c.from), ['Housewife', 'Romance', 'big tits']), // the exact duplicate is dropped without a note
  () => assert.equal(normalizeTags('Cheating, Affair, Infidelity').tags, 'Cheating'),
  () => assert.equal(normalizeTags('Web Series 2026, Desi').tags, 'Web Series, Desi'),
  () => assert.equal(normalizeTags('Sneaky sex,  Outdoor ,').tags, 'Sneaky sex, Outdoor'), // free tags untouched, blanks dropped
  () => assert.equal(normalizeTags('').tags, ''),
  () => assert.equal(normalizeTags(null).tags, ''),
  () => assert.deepEqual(normalizeTags('MILF, Jav').changes, []), // already canonical: nothing to report
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 3).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
