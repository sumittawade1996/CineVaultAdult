// node scripts/test-seo-text.mjs
import assert from 'node:assert/strict'
import { clipText } from '../src/lib/seoText.js'

const long = 'AI Movie collects VEXN’s AI-generated and AI-narrated fantasy scenes told through synthetic narration. Nothing here is live-action footage, and every clip is labelled as AI-generated so you know what you are watching before you press play.'
const cases = [
  () => assert.equal(clipText('Short text.', 160), 'Short text.'),
  () => assert.equal(clipText('  spaced   out \n text ', 160), 'spaced out text'),
  () => assert.equal(clipText('', 160), ''),
  () => assert.equal(clipText(null, 160), ''),
  // cuts at a sentence end when one falls in the second half
  () => assert.equal(clipText(long, 160), 'AI Movie collects VEXN’s AI-generated and AI-narrated fantasy scenes told through synthetic narration.'),
  // otherwise at a word, with an ellipsis, never longer than max
  () => {
    const out = clipText('word '.repeat(60), 40)
    assert.ok(out.length <= 40, `length ${out.length}`)
    assert.ok(out.endsWith('…'))
    assert.ok(!out.includes('wor…'))
  },
  () => assert.ok(clipText(long, 160).length <= 160),
  () => assert.ok(clipText('x'.repeat(500), 160).length <= 160),
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
