// node scripts/test-article-dates.mjs
import assert from 'node:assert/strict'
import { formatArticleDate, isUpdated } from '../src/lib/articleDates.js'

const cases = [
  () => assert.equal(formatArticleDate('2026-10-09T10:00:00Z'), '9 October 2026'),
  () => assert.equal(formatArticleDate('2026-10-09T23:30:00-05:00'), '10 October 2026'), // always shown in UTC, so server and browser agree
  () => assert.equal(formatArticleDate('not a date'), ''),
  () => assert.equal(formatArticleDate(null), ''),
  () => assert.equal(isUpdated({ created_at: '2026-10-09T10:00:00Z', updated_at: '2026-10-09T18:00:00Z' }), false), // same day
  () => assert.equal(isUpdated({ created_at: '2026-10-09T10:00:00Z', updated_at: '2026-10-18T09:00:00Z' }), true),
  () => assert.equal(isUpdated({ created_at: '2026-10-09T10:00:00Z' }), false),
  () => assert.equal(isUpdated(null), false),
]
let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 3).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
