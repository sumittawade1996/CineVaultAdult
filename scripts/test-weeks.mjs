// node scripts/test-weeks.mjs
import assert from 'node:assert/strict'
import { weekKey, parseWeekKey, weekLabel, summarizeWeeks } from '../src/lib/weeks.js'

const cases = [
  // week keys (ISO 8601, UTC)
  () => assert.equal(weekKey('2026-10-18T10:00:00Z'), '2026-w42'), // Sunday closes week 42
  () => assert.equal(weekKey('2026-10-19T00:00:00Z'), '2026-w43'), // Monday opens 43
  () => assert.equal(weekKey('2026-10-05T00:00:00Z'), '2026-w41'),
  () => assert.equal(weekKey('2026-01-01T12:00:00Z'), '2026-w01'),
  () => assert.equal(weekKey('2027-01-01T12:00:00Z'), '2026-w53'), // 2026 has 53 weeks
  () => assert.equal(weekKey('2024-12-30T12:00:00Z'), '2025-w01'), // belongs to next ISO year
  () => assert.equal(weekKey('not a date'), null),

  // parsing
  () => assert.equal(parseWeekKey('2026-w41').start.toISOString(), '2026-10-05T00:00:00.000Z'),
  () => assert.equal(parseWeekKey('2026-w41').end.toISOString(), '2026-10-12T00:00:00.000Z'),
  () => assert.equal(parseWeekKey('2026-w53').start.toISOString(), '2026-12-28T00:00:00.000Z'),
  () => assert.equal(parseWeekKey('2025-w53'), null), // 2025 has only 52
  () => assert.equal(parseWeekKey('2026-w00'), null),
  () => assert.equal(parseWeekKey('2026-41'), null),
  () => assert.equal(parseWeekKey('../etc'), null),
  () => assert.equal(parseWeekKey(undefined), null),

  // every week key survives a round trip
  () => {
    for (let w = 1; w <= 52; w++) {
      const key = `2026-w${String(w).padStart(2, '0')}`
      assert.equal(weekKey(parseWeekKey(key).start), key)
      assert.equal(weekKey(new Date(parseWeekKey(key).end.getTime() - 1)), key)
    }
  },

  // labels
  () => assert.equal(weekLabel('2026-w41'), '5–11 October 2026'),
  () => assert.equal(weekLabel('2026-w40'), '28 September – 4 October 2026'),
  () => assert.equal(weekLabel('2026-w53'), '28 December 2026 – 3 January 2027'),

  // summary
  () => {
    const out = summarizeWeeks(['2026-10-06T01:00:00Z', '2026-10-07T01:00:00Z', '2026-09-15T01:00:00Z', 'bad'])
    assert.deepEqual(out.map((w) => [w.key, w.count]), [['2026-w41', 2], ['2026-w38', 1]])
    assert.equal(out[0].label, '5–11 October 2026')
  },
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
