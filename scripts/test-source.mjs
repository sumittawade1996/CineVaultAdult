// node scripts/test-source.mjs
import assert from 'node:assert/strict'
import { sourceFromUrl } from '../src/lib/source.js'

const cases = [
  () => assert.equal(sourceFromUrl('https://www.eporner.com/embed/CQSGMJCwE80'), 'Eporner'),
  () => assert.equal(sourceFromUrl('http://eporner.com/embed/x/'), 'Eporner'),
  () => assert.equal(sourceFromUrl('https://www.pornhub.org/embed/6a73db6702e56'), 'PornHub'),
  () => assert.equal(sourceFromUrl('https://www.pornhub.com/embed/abc'), 'PornHub'),
  () => assert.equal(sourceFromUrl('https://www.superporn.com/embed/134027/'), 'SuperPorn'),
  () => assert.equal(sourceFromUrl('https://luluvdo.com/e/uq2pocvz5tao'), 'Luluvdo'),
  () => assert.equal(sourceFromUrl('https://youtu.be/B6NVvtIz9_Q?si=x'), 'YouTube'),
  () => assert.equal(sourceFromUrl('https://www.youtube.com/watch?v=abc'), 'YouTube'),
  () => assert.equal(sourceFromUrl('https://example.com/embed/1'), null),
  () => assert.equal(sourceFromUrl('https://evil.example/?next=eporner.com/'), null), // not a host match
  () => assert.equal(sourceFromUrl(''), null),
  () => assert.equal(sourceFromUrl(null), null),
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n')[0]}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
