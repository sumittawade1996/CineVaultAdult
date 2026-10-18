// node scripts/test-partners.mjs
import assert from 'node:assert/strict'
import { normalizePartners, partnerAnchor, safeRel } from '../src/lib/partnerLinks.js'

const cases = [
  () => {
    const [p] = normalizePartners([{ name: 'VEXN India', label: 'VEXN India', url: 'https://www.vexn.co.in', rel: 'sponsored noopener', open_in_new_tab: true }])
    assert.deepEqual([p.href, p.text, p.rel, p.target], ['https://www.vexn.co.in/', 'VEXN India', 'sponsored noopener', '_blank'])
  },
  () => assert.equal(normalizePartners([{ name: 'Plain', url: 'https://a.example/?ref=vexn' }])[0].text, 'Plain'), // label falls back to name
  () => assert.equal(normalizePartners([{ name: 'X', url: 'https://a.example/?ref=vexn&x=1' }])[0].href, 'https://a.example/?ref=vexn&x=1'),
  () => assert.equal(normalizePartners([{ name: 'Same tab', url: 'https://a.example', open_in_new_tab: false }])[0].target, undefined),

  // /partners page fields
  () => assert.equal(normalizePartners([{ name: 'A', url: 'https://www.a.example/path' }])[0].host, 'a.example'), // www. dropped
  () => assert.equal(normalizePartners([{ name: 'A', url: 'https://sub.a.example' }])[0].host, 'sub.a.example'),
  () => {
    const [p] = normalizePartners([{ name: ' VEXN India ', label: 'VEXN IN', url: 'https://a.example', description: ' Short. ' }])
    assert.deepEqual([p.name, p.text, p.description, p.id], ['VEXN India', 'VEXN IN', 'Short.', 'vexn-india'])
  },
  () => assert.deepEqual(normalizePartners([{ name: 'A', url: 'https://a.example', details: 'One.\n\nTwo.\r\n \r\n  Three. \n' }])[0].details, ['One.', 'Two.', 'Three.']),
  () => assert.deepEqual(normalizePartners([{ name: 'A', url: 'https://a.example' }])[0].details, []),
  () => assert.equal(normalizePartners([{ name: 'A', url: 'https://a.example' }])[0].description, ''),
  () => assert.deepEqual(normalizePartners([{ name: 'Same', url: 'https://a.example' }, { name: 'Same', url: 'https://b.example' }, { name: 'Same', url: 'https://c.example' }]).map((p) => p.id), ['same', 'same-2', 'same-3']),
  () => assert.equal(normalizePartners([{ name: '***', url: 'https://www.a.example' }])[0].id, 'a-example'), // name with no usable characters: host
  () => assert.equal(partnerAnchor('  Hot & Cold!! Ltd. '), 'hot-cold-ltd'),
  () => assert.equal(partnerAnchor(null), ''),

  // unsafe or unusable rows are dropped
  () => assert.deepEqual(normalizePartners([{ name: 'JS', url: 'javascript:alert(1)' }]), []),
  () => assert.deepEqual(normalizePartners([{ name: 'Data', url: 'data:text/html,hi' }]), []),
  () => assert.deepEqual(normalizePartners([{ name: 'Rel', url: 'not a url' }]), []),
  () => assert.deepEqual(normalizePartners([{ name: '', label: '', url: 'https://a.example' }]), []),
  () => assert.deepEqual(normalizePartners(null), []),
  () => assert.deepEqual(normalizePartners(undefined), []),

  // rel handling: a paid link is always marked, unknown tokens are dropped
  () => assert.equal(safeRel('', false), 'sponsored'),
  () => assert.equal(safeRel('', true), 'sponsored noopener'),
  () => assert.equal(safeRel('nofollow', true), 'nofollow noopener'),
  () => assert.equal(safeRel('sponsored opener evil', false), 'sponsored'),
  () => assert.equal(safeRel('SPONSORED   NoReferrer', true), 'sponsored noreferrer noopener'),
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
