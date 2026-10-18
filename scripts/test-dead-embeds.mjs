// node scripts/test-dead-embeds.mjs
import assert from 'node:assert/strict'
import { apiUrl, classify, sourceOf } from './lib/embedCheck.mjs'

const cases = [
  // which source a trailer_url belongs to
  () => assert.deepEqual(sourceOf('https://www.eporner.com/embed/08NPZ9AfT8H/Alyx-Star-Is-On-Top/'), { source: 'eporner', code: '08NPZ9AfT8H' }),
  () => assert.deepEqual(sourceOf('http://eporner.com/embed/abc123'), { source: 'eporner', code: 'abc123' }),
  () => assert.deepEqual(sourceOf('https://www.pornhub.org/embed/690978c0086a1'), { source: 'pornhub', code: '690978c0086a1' }),
  () => assert.deepEqual(sourceOf('https://www.pornhub.com/embed/ph5e1'), { source: 'pornhub', code: 'ph5e1' }),
  () => assert.equal(sourceOf('https://luluvdo.com/e/oltnem9ml9gt'), null),
  () => assert.equal(sourceOf('https://youtu.be/B6NVvtIz9_Q'), null),
  () => assert.equal(sourceOf('https://evil.example/?u=https://www.eporner.com/embed/abc'), null),
  () => assert.equal(sourceOf(null), null),
  () => assert.equal(sourceOf(''), null),

  // API urls
  () => assert.equal(apiUrl({ source: 'eporner', code: 'abc' }), 'https://www.eporner.com/api/v2/video/id/?id=abc&format=json'),
  () => assert.equal(apiUrl({ source: 'pornhub', code: 'abc' }), 'https://www.pornhub.com/webmasters/video_by_id?id=abc'),

  // Eporner: an empty array is the "removed" answer; anything unclear is an error
  () => assert.equal(classify('eporner', 200, '[]'), 'dead'),
  () => assert.equal(classify('eporner', 200, '{"id":"08NPZ9AfT8H","title":"x"}'), 'ok'),
  () => assert.equal(classify('eporner', 200, '{"foo":1}'), 'error'),
  () => assert.equal(classify('eporner', 200, '[{"id":"x"}]'), 'error'),
  () => assert.equal(classify('eporner', 200, '<html>blocked</html>'), 'error'),
  () => assert.equal(classify('eporner', 429, '[]'), 'error'), // a rate limit must never read as "removed"
  () => assert.equal(classify('eporner', 503, ''), 'error'),
  () => assert.equal(classify('eporner', 200, ''), 'error'),

  // Pornhub
  () => assert.equal(classify('pornhub', 200, '{"video":{"video_id":"690978c0086a1","title":"x"}}'), 'ok'),
  () => assert.equal(classify('pornhub', 200, '{"code":"2002","message":"No video with this ID."}'), 'dead'),
  () => assert.equal(classify('pornhub', 200, '{"code":"2001","message":"Other"}'), 'error'),
  () => assert.equal(classify('pornhub', 403, '{"code":"2002"}'), 'error'),
]

let failed = 0
cases.forEach((run, i) => {
  try {
    run()
  } catch (err) {
    failed++
    console.log(`  FAIL #${i + 1}: ${err.message.split('\n')[0]}`)
  }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
