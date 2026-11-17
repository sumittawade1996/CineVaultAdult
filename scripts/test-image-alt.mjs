// node scripts/test-image-alt.mjs
import assert from 'node:assert/strict'
import { cardAlt, posterAlt, tileAlt, mainCategory, categoryWords, joinNames } from '../src/lib/imageAlt.js'

const cases = [
  // card: performers + main category + studio, no title
  () => assert.equal(cardAlt({ title: 'Pray for Me', actors: 'Lena Paul, Ivy Lebelle', tags: 'HD, Threesome, MILF', channel: 'Vixen' }), 'Lena Paul and Ivy Lebelle threesome video from Vixen'),
  () => assert.equal(cardAlt({ title: 'Kiss To Face', actors: 'Lucy Li, Ornella Morgan, Morgan Rodriguez, Extra Name', tags: 'Lesbian, 4K' }), 'Lucy Li, Ornella Morgan and Morgan Rodriguez lesbian video'),
  // the catch-all VEXN channel is not named
  () => assert.equal(cardAlt({ title: 'X', actors: 'Lena Paul', tags: 'MILF', channel: 'VEXN' }), 'Lena Paul MILF video'),
  // no performer: category (+ studio) then the title
  () => assert.equal(cardAlt({ title: 'Kaam Sukh Bhabhi', actors: '', tags: 'Web Series, Desi, Bhabhi', channel: 'Ullu' }), 'Desi video from Ullu: Kaam Sukh Bhabhi'),
  () => assert.equal(cardAlt({ title: 'Hot Massage', actors: null, tags: 'HD', channel: null }), 'Video: Hot Massage'),
  () => assert.equal(cardAlt({ title: '', actors: '', tags: '', channel: '' }), 'Video'),
  // long titles are cut at a word
  () => {
    const alt = cardAlt({ title: 'A '.repeat(30) + 'very long title that keeps going and going well past the limit', tags: 'Anal' })
    assert.ok(alt.length <= 'Anal video: '.length + 80, alt)
    assert.ok(alt.endsWith('…'), alt)
  },
  // only controlled categories, never a free tag; aliases count
  () => assert.equal(mainCategory('Stepmom, Big Tits'), 'Big Tits'),
  () => assert.equal(mainCategory('Teens, Petite'), 'Petite'),
  () => assert.equal(mainCategory('nuru, HD'), 'Nuru Massage'),
  () => assert.equal(mainCategory('Housewife'), 'Housewives'),
  () => assert.equal(mainCategory('HD, 4K, Brazzers'), null),
  () => assert.equal(mainCategory(''), null),
  () => assert.equal(cardAlt({ title: 'T', actors: 'A B', tags: 'Stepsister, Hardcore' }), 'A B hardcore video'),
  // category wording inside a sentence
  () => assert.equal(categoryWords('Big Tits'), 'big tits'),
  () => assert.equal(categoryWords('MILF'), 'MILF'),
  () => assert.equal(categoryWords('Jav'), 'JAV'),
  () => assert.equal(categoryWords('Nuru Massage'), 'Nuru massage'),
  () => assert.equal(categoryWords('Indian'), 'Indian'),
  () => assert.equal(categoryWords('Group Sex'), 'group sex'),
  () => assert.equal(joinNames([]), ''),
  () => assert.equal(joinNames(['A']), 'A'),
  () => assert.equal(joinNames(['A', 'B']), 'A and B'),
  // video page poster: title, performers not already in the title, category
  () => assert.equal(posterAlt({ title: 'Pray for Me', actors: 'Lena Paul, Ivy Lebelle', tags: 'Threesome' }), 'Pray for Me with Lena Paul and Ivy Lebelle – threesome video poster'),
  () => assert.equal(posterAlt({ title: 'Lena Paul – Frisky Fun #99', actors: 'Lena Paul, Baby Gemini', tags: 'Interracial' }), 'Lena Paul – Frisky Fun #99 with Baby Gemini – interracial video poster'),
  () => assert.equal(posterAlt({ title: 'Kendra Sunderland Solo', actors: 'Kendra Sunderland', tags: 'HD' }), 'Kendra Sunderland Solo – video poster'),
  () => assert.equal(posterAlt({ title: '', actors: '', tags: 'POV' }), 'POV video poster'),
  // tiles
  () => assert.equal(tileAlt('MILF'), 'MILF porn videos'),
  () => assert.equal(tileAlt(' Lena Paul '), 'Lena Paul porn videos'),
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
