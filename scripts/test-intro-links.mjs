// node scripts/test-intro-links.mjs
import assert from 'node:assert/strict'
import { introLinkPaths, introParagraphs, introParts, plainIntro } from '../src/lib/introLinks.js'

const cases = [
  // site pages become links, the words around them stay
  () => assert.deepEqual(introParts('See [Angela White](/actor/angela-white) here.'), [{ text: 'See ' }, { text: 'Angela White', to: '/actor/angela-white' }, { text: ' here.' }]),
  () => assert.deepEqual(introLinkPaths('[a](/category/big-tits), [b](/channel/brazzers) and [c](/channels)'), ['/category/big-tits', '/channel/brazzers', '/channels']),
  () => assert.deepEqual(introLinkPaths('[week](/new/2026-w41) [scene](/movie/some-scene-2)'), ['/new/2026-w41', '/movie/some-scene-2']),
  () => assert.deepEqual(introParts('[MILF](/category/milf/)'), [{ text: 'MILF', to: '/category/milf' }]), // a trailing slash is dropped
  // anything that is not a page of this site keeps its words and is not a link
  () => assert.deepEqual(introParts('[Eporner](https://www.eporner.com/)'), [{ text: 'Eporner' }]),
  () => assert.deepEqual(introParts('[x](javascript:alert(1))').filter((p) => p.to), []),
  () => assert.deepEqual(introParts('[x](//evil.example/actor/a)').filter((p) => p.to), []),
  () => assert.deepEqual(introParts('[admin](/admin/dashboard)'), [{ text: 'admin' }]),
  () => assert.deepEqual(introParts('[upper](/category/Big-Tits)'), [{ text: 'upper' }]), // site addresses are lower case
  // text without links, and brackets that are not a link, pass through
  () => assert.deepEqual(introParts('Plain text.'), [{ text: 'Plain text.' }]),
  () => assert.deepEqual(introParts('Runtime [about 30 min] varies.'), [{ text: 'Runtime [about 30 min] varies.' }]),
  () => assert.deepEqual(introParts(''), []),
  // the plain wording for search descriptions
  () => assert.equal(plainIntro('[Brazzers](/channel/brazzers) scenes with\n[Angela White](/actor/angela-white).'), 'Brazzers scenes with Angela White.'),
  () => assert.equal(plainIntro(null), ''),
  // paragraphs
  () => assert.deepEqual(introParagraphs('First line\ncontinues.\n\nSecond.\n \n\nThird.'), ['First line continues.', 'Second.', 'Third.']),
  () => assert.deepEqual(introParagraphs('Only one.'), ['Only one.']),
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 4).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
