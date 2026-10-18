// node scripts/test-content-rules.mjs
import assert from 'node:assert/strict'
import { checkContent } from '../src/lib/contentRules.js'

// [fields, expected block ids, expected review ids]
const cases = [
  // clean titles that must pass untouched
  [{ title: 'Angela White - The Lucky Guy', tags: 'Hardcore, Big Tits, Pornstar' }, [], []],
  [{ title: "Bhabhi's Hot Romance - Part 4", tags: 'Bhabhi, Desi, Romance' }, [], []],
  [{ title: 'Romantic Sex In A Hotel While Her Husband Is Away', tags: 'Romantic, Big Tits' }, [], []],
  [{ title: 'Lena Paul - Third Wheel Threesome', tags: 'Threesome, Big Tits' }, [], []],
  [{ title: 'Enforced curfew night in the city', tags: '' }, [], []], // "enforced" is not "forced"
  [{ title: 'MILF Loves A Younger Guy - Blair Williams', tags: 'MILF, Housewives' }, ['youth-school'], []], // retitled "stepson" row

  // blocked themes
  [{ title: 'Stepmom Comatozze Asks For A Massage' }, ['step-family'], []],
  [{ title: 'Stiefschwester Nach Dem Sport Gefickt' }, ['step-family'], []],
  [{ title: 'Bhabhi Sex With Father-In-Law In Bedroom' }, ['step-family'], []],
  [{ title: 'Selina Bentz - College Student Fucked In The Library', tags: 'Teen' }, ['youth-school'], []],
  [{ title: 'Outdoor Priya Sex - College Girl' }, ['youth-school'], []],
  [{ title: 'Marathi Girl\'s Leaked MMS From A Pune Oyo Room' }, ['leaked-hidden-cam'], []],
  [{ title: 'Curvy Roommates Forced to Share a Single Hotel Bed' }, ['forced'], []],
  [{ title: 'Dominant Lesbian Teacher Forces Mom & Schoolgirl', tags: 'Teacher' }, ['forced', 'youth-school'], ['family-word', 'teacher']],
  [{ title: 'Virgin Boy Meets Bimbo MILF' }, ['virgin'], []],
  [{ title: 'Hypno session', tags: '' }, ['hypno'], []],
  [{ title: 'Nothing special', tags: 'Teen, Anal' }, ['youth-school'], []],
  [{ title: 'Young Girl Tries Something New' }, ['youth-school'], []],
  [{ title: 'Father in Law - Saeko Matsushita - [Full Video]' }, ['step-family'], []], // written without hyphens
  [{ title: "Married Woman's Ulterior Motive... She Wants To Be Fo**ed. 3" }, ['forced'], []], // masked "Forced"

  // the slug counts too (a reworded title can keep the old URL)
  [{ title: 'Husband Gone, MILF Seduced by a Persistent Neighbor', slug: 'husband-gone-milf-seduced-by-strong-father-in-law' }, ['step-family'], []],
  [{ title: 'Sexy Pupil Flirts With Her Piano Instructor', slug: 'sexy-student-in-private-piano-lesson-flirted-with-teacher' }, ['youth-school'], ['teacher']],

  // review-only
  [{ title: 'Dibs On Mom' }, [], ['family-word']],
  [{ title: 'Sexy Pooja Bhabhi Ko Jija Ne Chod Diya', tags: 'Bhabhi, Desi' }, [], ['desi-relation']],
  [{ title: "Krissy Lynn - My First Sex Teacher", tags: 'Teacher' }, [], ['teacher']],
  [{ title: 'Finish Fast Before She Wakes Up', tags: 'Sneaky sex' }, [], ['sleeping']],
]

let failed = 0
for (const [movie, block, review] of cases) {
  const got = checkContent(movie)
  const gb = got.block.map((h) => h.id).sort()
  const gr = got.review.map((h) => h.id).sort()
  try {
    assert.deepEqual(gb, [...block].sort())
    assert.deepEqual(gr, [...review].sort())
    console.log('  ok  ', JSON.stringify(movie.title))
  } catch (e) {
    failed++
    console.log('  FAIL', JSON.stringify(movie.title), 'block', gb, 'review', gr, '| expected', block, review)
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
