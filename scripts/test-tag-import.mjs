// node scripts/test-tag-import.mjs
import assert from 'node:assert/strict'
import { buildTagSeoDescription, buildTagSeoTitle, buildTagSlug, buildTagTitle, dropReversedNames, hasTags, tagBrand, tagExcludeReason } from './lib/tagImport.mjs'
import { checkContent } from '../src/lib/contentRules.js'

const tag = tagBrand('Japanese Big Tits')
const ok = { title: 'Chihiro Ogino Stunning JAV BBW Uncensored', keywords: 'jav, asian, big tits, japanese, cumshot', length_sec: 136 * 60 }
const opts = { requireTags: ['japanese', 'big tits'] }

const cases = [
  // ---- who qualifies
  () => assert.equal(tagExcludeReason(ok, tag, opts), null),
  () => assert.equal(tagExcludeReason({ ...ok, length_sec: 12 * 60 }, tag, opts), 'under 20 minutes'),
  () => assert.match(tagExcludeReason({ ...ok, length_sec: 400 * 60 }, tag, opts), /over 240/),
  () => assert.equal(tagExcludeReason({ ...ok, keywords: 'asian, japanese, blowjob, big tits' }, tag, opts), 'blowjob'),
  () => assert.equal(tagExcludeReason({ ...ok, title: 'Busty wife sucks and fucks' }, tag, opts), 'blowjob'), // the act in the title counts too
  () => assert.equal(tagExcludeReason({ ...ok, keywords: 'asian, japanese, blowjob, big tits' }, tag, { ...opts, allowBlowjob: true }), null), // only for a held set
  // a listing page also shows other videos: every required tag must be among the keywords
  () => assert.equal(tagExcludeReason({ ...ok, keywords: 'latina, big ass, big tits' }, tag, opts), 'not tagged for this listing'),
  () => assert.equal(hasTags('asian, busty, japanese', ['japanese', 'big tits']), true), // "busty" is a spelling of Big Tits
  () => assert.equal(hasTags('asian, japanese', ['japanese', 'big tits']), false),
  () => assert.equal(hasTags('anything', []), true),
  // titles that cannot be published
  () => assert.equal(tagExcludeReason({ ...ok, title: 'æ¨ææç¾ Uncensored' }, tag, opts), 'unreadable title'),
  () => assert.equal(tagExcludeReason({ ...ok, title: 'test-URE-081-AI-final' }, tag, opts), 'test upload title'),
  () => assert.equal(tagExcludeReason({ ...ok, title: 'Hubungan Gelap Mengulang Masa Lalu Creampie' }, tag, opts), 'not an English title'),
  () => assert.equal(tagExcludeReason({ ...ok, title: 'JAV English Sub-Titles 861 - Wankzone' }, tag, opts), 'names another studio'),
  () => assert.equal(tagExcludeReason({ ...ok, title: 'S W 5 6 7 A Hot spring Trip' }, tag, opts), 'code-like title'),
  () => assert.equal(tagExcludeReason({ ...ok, title: 'Japanese Anal N H D T A 275' }, tag, opts), 'code-like title'),
  () => assert.equal(tagExcludeReason({ ...ok, title: 'Hot Spring Trip With A Neighbour 2' }, tag, opts), null), // ordinary short words are fine
  // the site's own content rules still apply
  () => assert.match(tagExcludeReason({ ...ok, title: 'Japanese schoolgirl and her teacher' }, tag, opts), /content rule|guard/),
  () => assert.match(tagExcludeReason({ ...ok, title: 'Stepmom visits the hot spring' }, tag, opts), /content rule/),
  // ---- the performer's name in the other order is dropped
  () => assert.equal(dropReversedNames('The Nipples Of A Big-breasted Married Woman – Yuzuki Marina', ['Marina Yuzuki']), 'The Nipples Of A Big-breasted Married Woman –'),
  () => assert.equal(dropReversedNames('Plain title', ['Marina Yuzuki']), 'Plain title'),
  // ---- title, address and search texts
  () => assert.equal(buildTagTitle({ cast: ['Chitose Saegusa'], rawTitle: 'NIMA 037 - JAv', tag, minutes: 118 }), 'Chitose Saegusa – Nima 037 – JAV (118 Min)'),
  () => assert.equal(buildTagTitle({ cast: [], rawTitle: 'Chihiro Ogino Stunning JAV BBW Uncensored', tag, minutes: 136 }), 'Chihiro Ogino Stunning JAV BBW Uncensored (136 Min)'),
  () => assert.equal(buildTagTitle({ cast: [], rawTitle: 'Ok', tag, minutes: 30 }), ''), // nothing to name the video by
  () => assert.match(buildTagSlug({ cast: ['Chitose Saegusa'], rawTitle: 'NIMA 037 - JAv', tag }), /^chitose-saegusa-nima-037-jav-japanese-big-tits$/),
  () => {
    const t = buildTagSeoTitle({ cast: ['Chitose Saegusa'], rawTitle: 'NIMA 037 - JAv', tag, minutes: 118, tags: ['Japanese', 'Big Tits', 'Asian'] }, new Set())
    assert.ok(t.length >= 30 && t.length <= 53, t)
    assert.ok(t.endsWith('Japanese Big Tits'), t)
  },
  () => {
    const d = buildTagSeoDescription({ slug: 'x', tag, cast: ['Chitose Saegusa'], minutes: 118, tags: ['Japanese', 'Big Tits', 'Asian', 'MILF', 'Creampie'], scene: 'Nima 037 – JAV' })
    assert.ok(d.length >= 140 && d.length <= 160, `${d.length}: ${d}`)
    assert.match(d, /^Chitose Saegusa in "Nima 037 – JAV": a 118-minute Japanese Big Tits scene|^Japanese Big Tits porn video/)
    assert.doesNotMatch(d, /tagged Japanese|tagged Big Tits/) // the lead has them already
    assert.match(d, /tagged Asian/)
  },
  () => { // nothing the builders write trips the content rules
    const title = buildTagTitle({ cast: ['Chitose Saegusa'], rawTitle: 'NIMA 037 - JAv', tag, minutes: 118 })
    const hits = checkContent({ title, tags: 'Japanese, Big Tits, Asian', keywords: 'Japanese Big Tits' })
    assert.deepEqual([hits.block, hits.review], [[], []])
  },
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 4).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
