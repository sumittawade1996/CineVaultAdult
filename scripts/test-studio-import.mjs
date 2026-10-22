// node scripts/test-studio-import.mjs
import assert from 'node:assert/strict'
import { STUDIOS, buildSeoDescription, buildSeoTitle, buildSeoTitleUnique, castFromTitle, cleanCast, buildSlug, buildTitle, excludeReason, mapTags, posterFrom, sceneTitle } from './lib/studioImport.mjs'
import { checkContent } from '../src/lib/contentRules.js'

const B = STUDIOS.brazzers
const V = STUDIOS.vixen
const AT = STUDIOS['adult-time']
const ok = { title: 'Brazzers Exxtra Pranked And Fucked', keywords: 'Big Tits,MILF,Hardcore,Brazzers', length_sec: 1500 }

const cases = [
  // ---- who qualifies
  () => assert.equal(excludeReason(ok, B), null),
  () => assert.equal(excludeReason({ ...ok, length_sec: 1199 }, B), 'under 20 minutes'),
  () => assert.equal(excludeReason({ ...ok, length_sec: 20 * 60 }, B), null), // exactly 20 minutes counts
  () => assert.match(excludeReason({ ...ok, length_sec: 130 * 60 }, B), /over 90 minutes/),
  () => assert.equal(excludeReason({ ...ok, title: 'Some Other Studio Scene', keywords: 'Big Tits' }, B), 'studio not named'),
  () => assert.equal(excludeReason({ ...ok, title: 'Some Scene', keywords: 'Big Tits' }, B, { verifiedChannel: true }), null), // the official channel vouches for it
  // no blowjob videos, in the title or in the keywords
  () => assert.equal(excludeReason({ ...ok, keywords: 'Big Tits,Blowjob' }, B), 'blowjob'),
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers Blow Job Lesson' }, B), 'blowjob'),
  () => assert.equal(excludeReason({ ...ok, keywords: 'Big Tits,double blowjob' }, B), 'blowjob'),
  // the site's content rules, and the stricter guard of this importer
  () => assert.match(excludeReason({ ...ok, title: 'Brazzers Stepmom Fucks Her Stepson' }, B), /content rule/),
  () => assert.match(excludeReason({ ...ok, keywords: 'Big Tits,Teen (18+)' }, B), /content rule/),
  () => assert.match(excludeReason({ ...ok, keywords: 'Big Tits,College' }, B), /content rule/),
  () => assert.match(excludeReason({ ...ok, title: 'Brazzers Cheerleader Practice' }, B), /guard: Cheerleader/),
  () => assert.match(excludeReason({ ...ok, title: 'Adult Time Horniness Runs In The Family' }, AT), /guard: Family/), // family-themed titles read as role-play
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers Redhead Visits' }, B), null),
  () => assert.match(excludeReason({ ...ok, title: 'Brazzers Young Wife Visits' }, B), /guard/),
  () => assert.match(excludeReason({ ...ok, title: 'Brazzers Mom Walks In' }, B), /needs review: Mom/),
  () => assert.match(excludeReason({ ...ok, title: 'ADULT TIME Trans Scene' }, AT), /out of scope/),
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers Best Of 2024 Compilation' }, B), 'compilation'),
  // the act itself, not only the tag
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers Big Booty Blonde Sucks & Fucks BBC On Vacay' }, B), 'blowjob'),
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers Oral Practice' }, B), 'blowjob'),
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers Face Fuck Lesson' }, B), 'blowjob'),
  () => assert.equal(excludeReason({ ...ok, keywords: 'Big Tits,Deep Throat' }, B), 'blowjob'),
  // an upload that only mentions the studio is not the studio's: the title must name it, and amateur markers rule it out
  () => assert.equal(excludeReason({ ...ok, title: 'Pranked And Fucked', keywords: 'Big Tits,Brazzers' }, B), 'studio only in keywords'),
  () => assert.equal(excludeReason({ ...ok, keywords: 'Homemade,Brazzers' }, B), 'looks like an amateur upload'),
  () => assert.equal(excludeReason({ ...ok, title: 'Laney And Sylvia Brazzers', keywords: 'OnlyFans' }, B), 'looks like an amateur upload'),
  () => assert.equal(excludeReason({ ...ok, keywords: 'Amateur,Big Tits' }, B), null), // the loose tag "amateur" alone does not rule a studio scene out
  () => assert.equal(excludeReason({ ...ok, title: 'Some Scene', keywords: 'Homemade,Big Tits' }, B, { verifiedChannel: true }), null), // the studio's own channel is trusted
  // Vixen: the word is also a noun, so a title that merely contains it does not count
  () => assert.equal(excludeReason({ title: 'Cheeky Single Vixen Moves In', keywords: 'Big Tits', length_sec: 1800 }, V), 'studio not named'),
  () => assert.equal(excludeReason({ title: 'Vixen - Tiny Juniper Rewards Her Boyfriend', keywords: 'Big Tits', length_sec: 1800 }, V), null),

  // ---- tags
  () => {
    const tags = mapTags('Gonzo,HD porn,straight porn,Natural Tits,MILF,Blowjob,Hardcore,Threesome,Caucasian,Big Ass', B)
    assert.equal(tags, 'Brazzers, Big Tits, MILF, Threesome, Big Ass, Hardcore') // studio first, then the most searched (Threesome 25 before Big Ass 19), no junk and no blowjob
  },
  () => assert.equal(mapTags('Anal,p.o.v.,Pornstar,Big Dick', B), 'Brazzers, Anal, POV, Big Dick'),
  () => assert.equal(mapTags('Facial,Cosplay', B, new Map([['cosplay', 'Cosplay']])), 'Brazzers, Cosplay'), // a free tag only when the site already uses it
  () => assert.equal(mapTags('', B), 'Brazzers'),
  () => assert.equal(mapTags('Amateur,Homemade,Big Tits', B), 'Brazzers, Big Tits'), // loose uploader tags that do not fit a studio's scene

  // ---- titles
  () => assert.equal(sceneTitle('BRAZZERS - Dan Dangler’s Sensual Massage Gets Extra Slippery With Angela White And Ricky Johnson', ['Angela White', 'Ricky Johnson'], B), 'Dan Dangler’s Sensual Massage Gets Extra Slippery'),
  () => assert.equal(sceneTitle('Brazzers Exxtra   Pranked, Yanked & Fucked   Skylar Vox', ['Skylar Vox'], B), 'Pranked, Yanked & Fucked'),
  () => assert.equal(sceneTitle('ADULT TIME - GORGEOUS MOCHA MENAGE WANTS YOU TO WATCH', [], AT), 'Gorgeous Mocha Menage Wants You To Watch'), // shouting capitals become title case
  () => assert.equal(sceneTitle('Brazzers - Gives Herself Oily ANAL EXAM For A HUGE DICK, MILF Edition', [], B), 'Gives Herself Oily Anal Exam For A Huge Dick, MILF Edition'), // shouted words normalised, acronyms kept
  () => {
    // with no credited cast, the scene's own words go into the search description
    const d = buildSeoDescription({ slug: 'x', studio: B, cast: [], minutes: 25, tags: ['Brazzers', 'MILF', 'Big Ass'], scene: 'Pranked, Yanked & Fucked' })
    assert.ok(d.includes('Pranked, Yanked & Fucked') && d.length >= 140 && d.length <= 160, `${d.length}: ${d}`)
  },
  () => assert.equal(buildTitle({ cast: ['Angela White', 'Ricky Johnson'], rawTitle: 'BRAZZERS - Dan Dangler’s Sensual Massage', studio: B }), 'Angela White & Ricky Johnson – Dan Dangler’s Sensual Massage (Brazzers)'),
  () => assert.equal(buildTitle({ cast: [], rawTitle: 'Brazzers - A Day At The Spa', studio: B }), 'A Day At The Spa (Brazzers)'),
  () => assert.equal(buildSlug({ cast: ['Angela White'], rawTitle: 'Brazzers - A Day At The Spa', studio: B }), 'angela-white-a-day-at-the-spa-brazzers'),
  () => assert.deepEqual(posterFrom('https://static-ca-cdn.eporner.com/thumbs/static4/1/18/185/18500931/8_240.jpg'), { large: 'https://imggen.eporner.com/18500931/1280/720/8.jpg', small: 'https://static-ca-cdn.eporner.com/thumbs/static4/1/18/185/18500931/8_240.jpg' }),

  // ---- the search texts always fit their ranges and carry the studio, the cast and the length
  () => {
    const samples = [
      { cast: ['Angela White', 'Ricky Johnson'], raw: 'BRAZZERS - Dan Dangler’s Sensual Massage Gets Extra Slippery With Angela White And Ricky Johnson', studio: B, minutes: 38, tags: ['Brazzers', 'Big Tits', 'MILF', 'Massage'] },
      { cast: ['Skylar Vox'], raw: 'Brazzers Exxtra   Pranked, Yanked & Fucked   Skylar Vox', studio: B, minutes: 20, tags: ['Brazzers', 'Hardcore'] },
      { cast: [], raw: 'ADULT TIME - Gorgeous Mocha Menage Wants You To Watch Him', studio: AT, minutes: 22, tags: ['Adult Time'] },
      { cast: ['Tiny Juniper', 'Ren'], raw: 'Vixen - Tiny Juniper Ren Rewards Her Boyfriend With Wet Pussy', studio: V, minutes: 24, tags: ['Vixen', 'Big Tits', 'Brunette', 'Threesome', 'Anal'] },
      { cast: ['A Very Long Performer Name Indeed', 'Another Equally Long Performer Name'], raw: 'Brazzers - An Unreasonably Long Scene Title That Keeps Going And Going For Ever And Ever', studio: B, minutes: 61, tags: ['Brazzers', 'Big Tits'] },
    ]
    for (const s of samples) {
      const slug = buildSlug({ cast: s.cast, rawTitle: s.raw, studio: s.studio })
      const st = buildSeoTitle({ cast: s.cast, rawTitle: s.raw, studio: s.studio, minutes: s.minutes })
      const sd = buildSeoDescription({ slug, studio: s.studio, cast: s.cast, minutes: s.minutes, tags: s.tags })
      assert.ok(st.length >= 30 && st.length <= 53, `seo_title ${st.length}: ${st}`)
      assert.ok(st.endsWith(` – ${s.studio.name}`) || st.includes(s.studio.name), `studio missing in title: ${st}`)
      assert.ok(sd.length >= 140 && sd.length <= 160, `seo_description ${sd.length}: ${sd}`)
      assert.ok(sd.includes(s.studio.name) && sd.includes(`${s.minutes}`), `studio or length missing: ${sd}`)
      if (s.cast[0]) assert.ok(sd.includes(s.cast[0]), `cast missing: ${sd}`)
      assert.equal(checkContent({ title: st, description: sd }).block.length, 0)
      assert.ok(!/\b(?:hd|free|best|steamy|viral|trending|blowjob)\b/i.test(`${st} ${sd}`), `claim or banned word: ${st} | ${sd}`)
    }
  },
  // upload titles are tidied: file-name dates and codes, quality words, lower case, "Network", acronyms
  () => assert.deepEqual(castFromTitle('26 09 04 kendra sunderland and alina lopez 9awd'), ['Kendra Sunderland', 'Alina Lopez']),
  () => assert.deepEqual(castFromTitle('26 07 31 angela white 9eb6'), ['Angela White']),
  () => assert.deepEqual(castFromTitle('Angela White And Ricky Johnson'), []),
  () => assert.deepEqual(castFromTitle('26 07 31 vixen 4k upscale'), []), // no code with a digit, and a single word is not a name
  () => assert.equal(sceneTitle('26 07 31 angela white 9eb6', ['Angela White'], V), 'Scene 31 Jul 2026'),
  () => assert.equal(sceneTitle('Lauren Phillips Dp 1080p', ['Lauren Phillips'], B), 'DP'),
  () => assert.equal(sceneTitle('Vixen Sensual Dinner 4K Upscale', [], V), 'Sensual Dinner'),
  () => assert.equal(sceneTitle('fainting bride needs double dick injection', [], B), 'Fainting Bride Needs Double Dick Injection'),
  () => assert.equal(sceneTitle("brazzers she's got a dick's worth", [], B), "She's Got A Dick's Worth"), // no capital after an apostrophe
  () => assert.equal(sceneTitle('Bangbros Network - Big Dick And Tiny Pussy', [], STUDIOS.bangbros), 'Big Dick And Tiny Pussy'),
  () => assert.equal(excludeReason({ ...ok, title: 'âââ âââââ âââ Brazzers' }, B), 'unreadable title'),
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers Vogel 43 Scarlet Fever Sc7' }, B), 'file-name style title'),
  // file-name titles that start with the studio's name, codes without a digit
  () => assert.deepEqual(castFromTitle('Vixen 26 08 25 nancy ace Jxql', V), ['Nancy Ace']),
  () => assert.deepEqual(castFromTitle('Vixen 26 09 04 Kendra Sunderland And Alina Lopez 9awd', V), ['Kendra Sunderland', 'Alina Lopez']),
  () => assert.equal(sceneTitle('Vixen 26 08 25 nancy ace Jxql', ['Nancy Ace'], V), 'Scene 25 Aug 2026'),
  // what removing the cast leaves behind
  () => assert.equal(sceneTitle('Adult Time - Lusty Lesbian BBW Enjoys Fisting And Tribbing With Angela White & Courtney Trouble!', ['Angela White', 'Courtney Trouble'], AT), 'Lusty Lesbian BBW Enjoys Fisting And Tribbing!'),
  () => assert.equal(sceneTitle('Adult Time - Employee Discount - (Jenna Sativa, Gia Derza)', ['Jenna Sativa', 'Gia Derza'], AT), 'Employee Discount'),
  () => assert.equal(sceneTitle('Layla London in Fucking in the kitchen with her big tits', ['Layla London'], STUDIOS.bangbros), 'Fucking In The Kitchen With Her Big Tits'),
  () => assert.equal(sceneTitle('Bangbros Cheating Babe Fucked On Backseat.', [], STUDIOS.bangbros), 'Cheating Babe Fucked On Backseat'),
  () => assert.equal(sceneTitle('Bangbros Finally We Re Alone, Don T Tell', [], STUDIOS.bangbros), "Finally We're Alone, Don't Tell"),
  () => assert.equal(sceneTitle('Daphne Rosen y Aurora Jolie - Y - Big Wet Butts', ['Daphne Rosen', 'Aurora Jolie'], B), 'Big Wet Butts'),
  // a lower-case tag glued to the end is spam, not the scene's name
  () => assert.equal(sceneTitle('Brazzers Little Ebony MILF Misty - girl-masturbating', [], B), 'Little Ebony MILF Misty'),
  () => assert.equal(sceneTitle('Brazzers Gorgeous Body Of Blondie surprise', [], B), 'Gorgeous Body Of Blondie'),
  () => assert.equal(sceneTitle('brazzers exxtra planning for pussy', [], B), 'Planning For Pussy'), // all lower case: nothing is dropped
  () => assert.equal(sceneTitle('Belle Ohara - Brazzers - Day With A Pornstar (09.11.2025) a8gn', ['Belle Ohara'], B), 'Day With A Pornstar (09.11.2025)'),
  () => assert.equal(sceneTitle('Vixen Nancy Ace Hotel Season 3 Episode 4 XXX', [], V), 'Nancy Ace Hotel Season 3 Episode 4'),
  () => assert.equal(excludeReason({ title: 'Vixen .17.02.08.kendra.sunderland.XXX Mx8m', keywords: 'Big Tits', length_sec: 1800 }, V), 'file-name style title'),
  () => assert.match(excludeReason({ title: 'Vixen Takes Care Of A Monster Cock', keywords: 'Big Tits', length_sec: 1800 }, V), /studio not named/), // here the word is a noun
  () => assert.equal(excludeReason({ title: 'Vixen 26 07 31 angela white 9eb6', keywords: 'Big Tits', length_sec: 1800 }, V), null),
  // one entry per performer, no tag words or studio names among them
  () => assert.deepEqual(cleanCast(['Anna Claire Clouds', 'Anna Claire'], STUDIOS.bangbros), ['Anna Claire Clouds']),
  () => assert.deepEqual(cleanCast(['Lindsey Meadows', 'Lindsay Meadows'], STUDIOS.bangbros), ['Lindsey Meadows']),
  () => assert.deepEqual(cleanCast(['Sofia Nix', 'Juliana Bangbros', 'Camila Bangbros'], STUDIOS.bangbros), ['Sofia Nix']),
  () => assert.deepEqual(cleanCast(['Angela White', 'Angela Milf', 'Angela B'], B), ['Angela White']),
  () => assert.deepEqual(cleanCast(['Ricky Johnson', 'Angela White'], B), ['Ricky Johnson', 'Angela White']),
  // more reasons for leaving a video out
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers Blowbang Party' }, B), 'blowjob'),
  () => assert.equal(excludeReason({ ...ok, keywords: 'Big Tits,Swallow' }, B), 'blowjob'),
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers Sri Lankan Threesome' }, B), 'looks like an amateur upload'),
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers Scene From Naughty America' }, B), 'names another studio'),
  () => assert.equal(excludeReason({ ...ok, title: 'Brazzers And Bangbros Mix' }, B), 'names another studio'),
  () => assert.equal(excludeReason({ ...ok, title: 'Babe Cumpilation Brazzers' }, B), 'compilation'),
  // a cut title does not end on a dangling word
  () => assert.equal(buildSeoTitle({ cast: [], rawTitle: 'Bangbros Blonde Milf Hotwife Arinna Cum Gets A New Dick', studio: STUDIOS.bangbros, minutes: 39 }), 'Blonde MILF Hotwife Arinna Cum Gets – Bangbros'),
  // a title that is already taken gets the next honest variant instead of the video being dropped
  () => {
    const a = { cast: ['Angela White', 'Ricky Johnson'], rawTitle: 'BRAZZERS - Dan Dangler’s Sensual Massage Gets Extra Slippery', studio: B, minutes: 38, tags: ['Brazzers', 'Big Tits', 'MILF'] }
    const first = buildSeoTitleUnique(a)
    assert.equal(first, buildSeoTitle(a)) // nothing taken: the normal title
    const second = buildSeoTitleUnique(a, new Set([first.toLowerCase()]))
    assert.notEqual(second, first)
    assert.ok(second.length >= 30 && second.length <= 53 && second.endsWith(' – Brazzers'), second)
    const third = buildSeoTitleUnique(a, new Set([first.toLowerCase(), second.toLowerCase()]))
    assert.ok(![first, second].includes(third) && third.length >= 30 && third.length <= 53 && third.includes('Brazzers'), third)
  },
  // no cast and a short scene: still 30-53 characters, with the studio
  () => {
    const t = buildSeoTitleUnique({ cast: [], rawTitle: 'Brazzers - Spa Day', studio: B, minutes: 25, tags: ['Brazzers', 'MILF'] })
    assert.ok(t.length >= 30 && t.length <= 53 && t.includes('Brazzers'), t)
  },
  // the same video always gets the same text, and two different videos get different ones
  () => {
    const a = { slug: 'one', studio: B, cast: ['A One'], minutes: 30, tags: ['Brazzers', 'MILF'] }
    assert.equal(buildSeoDescription(a), buildSeoDescription({ ...a }))
    assert.notEqual(buildSeoDescription(a), buildSeoDescription({ ...a, slug: 'two', cast: ['B Two'] }))
  },
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 4).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
