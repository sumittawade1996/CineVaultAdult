// node scripts/test-fetch-all.mjs
import assert from 'node:assert/strict'
import { PAGE_SIZE, fetchAll } from '../src/lib/fetchAll.js'

// A fake Supabase query over `total` rows that, like PostgREST, never answers more than 1,000 rows per request.
const fake = (total, { failAt = null } = {}) => {
  const calls = []
  const build = () => ({
    range(from, to) {
      calls.push([from, to])
      if (failAt !== null && from === failAt) return Promise.resolve({ data: null, error: { message: 'boom' } })
      const end = Math.min(to, from + 999, total - 1)
      const data = []
      for (let i = from; i <= end; i++) data.push({ id: i })
      return Promise.resolve({ data, error: null })
    },
  })
  return { build, calls }
}

const cases = [
  async () => { // more rows than one request can return: all of them arrive, in order, once
    const { build, calls } = fake(2350)
    const { data, error } = await fetchAll(build)
    assert.equal(error, null)
    assert.equal(data.length, 2350)
    assert.deepEqual(data.map((r) => r.id), [...Array(2350).keys()])
    assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]])
  },
  async () => { // a short result is read in one request
    const { build, calls } = fake(40)
    const { data } = await fetchAll(build)
    assert.equal(data.length, 40)
    assert.equal(calls.length, 1)
  },
  async () => { // exactly one full page: one more request finds the end
    const { build, calls } = fake(PAGE_SIZE)
    const { data } = await fetchAll(build)
    assert.equal(data.length, PAGE_SIZE)
    assert.equal(calls.length, 2)
  },
  async () => { // an empty result is an empty list, not an error
    const { data, error } = await fetchAll(fake(0).build)
    assert.deepEqual(data, [])
    assert.equal(error, null)
  },
  async () => { // an error on a later page is reported, not hidden behind a partial list
    const { data, error } = await fetchAll(fake(3000, { failAt: 1000 }).build)
    assert.equal(data, null)
    assert.equal(error.message, 'boom')
  },
]

let failed = 0
for (const [i, run] of cases.entries()) {
  try { await run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 4).join(' | ')}`) }
}
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
