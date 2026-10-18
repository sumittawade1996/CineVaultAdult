// node scripts/test-movie-copy.mjs
import assert from 'node:assert/strict'
import { aOrAn, cleanSeoTitle, descriptiveTags, draftCopy, draftDescription, draftSeoDescription, draftSeoTitle, factualSentences, isClean, listJoin, rewriteCopy, scrubResolution, stripTitleClaims } from './lib/movieCopy.mjs'
import { checkContent } from '../src/lib/contentRules.js'

const BANNED = /\b(?:hd|full hd|steamy|viral|authentic|real chemistry|brings the heat|raw|trending|most[- ]watched|top[- ]rated|best|hottest|no signup|no download|free porn)\b/i
const base = { slug: 'alyx-star-office-scene-4k', title: 'Alyx Star – Office Scene in 4K (36 Min)', actors: 'Alyx Star', runtime_minutes: 36, tags: 'Cumshot, Hardcore, Big Dick, Office, Big Tits, Lingerie, Brunette, MILF, 4K', channel: null, source: 'Eporner' }
const rows = [
  base,
  { slug: 'a', title: 'Homemade clip', actors: null, runtime_minutes: 8, tags: 'Homemade, Amateur, Desi', channel: null, source: 'Eporner' },
  { slug: 'brazzers-run-club', title: 'Angela White & Scott Nails – Run Club Rules (Brazzers)', actors: 'Angela White, Scott Nails', runtime_minutes: 18, tags: 'Brazzers, Hardcore, Blowjob, Outdoor, Handjob, Big Tits, HD', channel: 'Brazzers', source: 'Eporner' },
  { slug: 'series-ep', title: 'Gharwali - Episode 4 - Hindi Web Series', actors: null, runtime_minutes: 37, tags: 'Web Series, Desi, Indian, Bhabhi', channel: null, source: 'Eporner' },
  { slug: 'jav-long', title: 'Long feature', actors: 'Mary Tachibana', runtime_minutes: 121, tags: 'Jav, Japanese, Brunette', channel: 'JAV Movies', source: 'Eporner' },
  { slug: 'many-cast', title: 'Group', actors: 'A One, B Two, C Three, D Four, E Five', runtime_minutes: 52, tags: 'Group Sex, Threesome', channel: null, source: null },
  { slug: 'no-runtime', title: 'Unknown length', actors: null, runtime_minutes: null, tags: 'Amateur', channel: null, source: 'PornHub' },
  { slug: 'no-tags', title: 'Bare', actors: 'Solo Performer', runtime_minutes: 20, tags: null, channel: null, source: 'Eporner' },
]

const cases = [
  () => assert.deepEqual(['11', '18', '8', '85', '15', '120', 'hour', 'scene', 'apple'].map((w) => aOrAn(`${w}-minute`)), ['an', 'an', 'an', 'an', 'a', 'a', 'a', 'a', 'an'].map((x, i) => (i === 6 || i === 7 ? 'a' : i === 8 ? 'an' : x)).slice(0, 9)),
  () => assert.equal(listJoin(['A', 'B', 'C']), 'A, B and C'),
  () => assert.equal(listJoin(['A']), 'A'),
  // labels and the channel name are not repeated as descriptive tags; 4K stays
  () => assert.deepEqual(descriptiveTags(rows[2]), ['Hardcore', 'Blowjob', 'Outdoor', 'Handjob', 'Big Tits']),
  () => assert.ok(descriptiveTags(base).includes('4K')),
  // every draft is within the limits and free of claims we cannot back
  () => rows.forEach((r) => {
    const c = draftCopy(r)
    assert.ok(c.description.length >= 200 && c.description.length <= 400, `description ${c.description.length} for ${r.slug}: ${c.description}`)
    assert.ok(c.seo_description.length >= 140 && c.seo_description.length <= 160, `seo ${c.seo_description.length} for ${r.slug}: ${c.seo_description}`)
    assert.ok(c.seo_title.length >= 30 && c.seo_title.length <= 53, `seo_title ${c.seo_title.length} for ${r.slug}: ${c.seo_title}`)
    for (const text of [c.description, c.seo_description]) {
      assert.ok(!BANNED.test(text), `banned wording in ${r.slug}: ${text}`)
      assert.equal(checkContent({ description: text }).block.length, 0, `blocked wording in ${r.slug}`)
    }
  }),
  // same row, same text
  () => assert.equal(draftDescription(base), draftDescription({ ...base })),
  // it states what the row says and nothing more
  () => assert.match(draftDescription(base), /Alyx Star/),
  () => assert.match(draftDescription(base), /36 minutes|36-minute/),
  () => assert.match(draftDescription(base), /office/i), // the title names an office
  () => assert.match(draftDescription(rows[3]), /episode 4 of a series/),
  () => assert.match(draftDescription(rows[1]), /No performers are listed|no performers are listed|no performers listed/),
  () => assert.match(draftDescription(rows[2]), /Brazzers channel/),
  () => assert.match(draftDescription(rows[5]), /A One, B Two, C Three and 2 others/),
  () => assert.ok(!/\bnull\b|undefined|NaN/.test(draftCopy(rows[6]).description + draftCopy(rows[7]).description)),
  // different rows do not collide
  () => assert.equal(new Set(rows.map((r) => draftSeoDescription(r))).size, rows.length),
  // search title
  () => assert.equal(draftSeoTitle({ title: 'Alyx Star – Office Scene in 4K (36 Min)', runtime_minutes: 36 }), 'Alyx Star – Office Scene in 4K'),
  () => assert.match(draftSeoTitle({ title: 'Short', runtime_minutes: 12 }), /^Short – 12 Min Video/), // a short title is padded with the runtime
  () => assert.ok(draftSeoTitle({ title: 'A very long title that keeps going and going well past the limit of fifty three characters', runtime_minutes: 5 }).length <= 53),
  // picture-quality phrases are scrubbed out of a sentence; a sentence left hanging is dropped
  () => assert.equal(scrubResolution('A gorgeous MILF cheats in this 16-minute 1080p video with blowjob.'), 'A gorgeous MILF cheats in this 16-minute video with blowjob.'),
  () => assert.equal(scrubResolution('Lena Paul headlines this feature, presented in stunning 4K quality.'), 'Lena Paul headlines this feature.'),
  () => assert.equal(scrubResolution('This 15-minute scene is shot in sharp 1080p HD.'), ''),
  () => assert.equal(scrubResolution('A 10-minute 4K public striptease.'), 'A 10-minute 4K public striptease.'), // a plain 4K tag is a fact about the file
  // what is kept and what is dropped
  () => assert.deepEqual(factualSentences('Alyx and Vanna share a 13-minute lesbian video. Searching for alyx? It streams free in full HD on VEXN with no signup. A solid pick for fans of lesbian porn.'), ['Alyx and Vanna share a 13-minute lesbian video.']),
  () => assert.equal(isClean('A tension-filled, taboo-flavored scene.'), false),
  () => assert.equal(isClean('Plays in an embedded player from Eporner.'), true),
  // search titles: a pitch at the end is cut, a claim in the middle sends the title back to the video title
  () => assert.equal(stripTitleClaims('Alyx Star & Vanna Bardot Lesbian – Free HD'), 'Alyx Star & Vanna Bardot Lesbian'),
  () => assert.equal(stripTitleClaims('Beautiful Girl Takes Sex Lessons, Anal Threesome HD'), 'Beautiful Girl Takes Sex Lessons, Anal Threesome'),
  () => assert.equal(stripTitleClaims('Hawas S02E01 2023 Hindi Web Series – Free 1080p'), 'Hawas S02E01 2023 Hindi Web Series'),
  () => assert.deepEqual(cleanSeoTitle({ title: 'X', seo_title: 'Chlo Fit Unique Encounter HD Scene', runtime_minutes: 35 }), { value: 'Chlo Fit Unique Encounter – 35 Min Video', mode: 'strip' }),
  () => assert.deepEqual(cleanSeoTitle({ title: 'Lena Paul – Pray For Me', seo_title: 'Lena Paul Pray for Me – Free HD MILF Video', runtime_minutes: 40 }), { value: 'Lena Paul Pray for Me – 40 Min Video', mode: 'strip' }),
  () => assert.equal(cleanSeoTitle({ title: 'Lena Paul – Pray For Me', seo_title: 'Lena Paul HD Pray For Me Threesome Scene', runtime_minutes: 40 }).mode, 'draft'), // a claim in the middle is not cut out
  () => assert.deepEqual(cleanSeoTitle({ title: 'X', seo_title: 'Autumn Falls – Nuru Massage Scene Online', runtime_minutes: 43 }), { value: 'Autumn Falls – Nuru Massage Scene Online', mode: 'keep' }),
  // a whole row
  () => {
    const row = { slug: 'kayley', title: 'Kayley Gunner & Mike Ox – Oiled Up After Tennis (Brazzers)', actors: 'Kayley Gunner, Mike Ox', runtime_minutes: 17, tags: 'Brazzers, Hardcore, Blowjob, Outdoor', channel: 'Brazzers', source: 'Eporner',
      description: 'Kayley Gunner and Mike Ox get oiled up after a game of tennis in this 17-minute Brazzers hardcore video. Looking for oiled up after tennis online? Watch the whole video free in HD on VEXN, no signup.',
      seo_description: 'After tennis, Kayley Gunner and Mike Ox get oiled up in this 17-minute Brazzers hardcore video. Watch the full free HD scene on VEXN with no signup.', seo_title: 'Kayley Gunner Oiled Up After Tennis – Brazzers' }
    const out = rewriteCopy(row)
    assert.deepEqual(out.mode, { description: 'hybrid', seo_description: 'hybrid', seo_title: 'keep' })
    assert.match(out.description, /^Kayley Gunner and Mike Ox get oiled up after a game of tennis/) // the clean opening is kept
    assert.match(out.description, /Brazzers channel/) // and the pitch is replaced by what the row states
    assert.ok(isClean(out.description) && isClean(out.seo_description))
    assert.ok(out.seo_description.length >= 140 && out.seo_description.length <= 160)
  },
  // a field that is already clean is left alone
  () => {
    const d = 'Kayley Gunner and Mike Ox get oiled up after a game of tennis in this 17-minute video. It plays in an embedded player from Eporner, not on VEXN. The Hardcore category lists similar videos on this site.'
    assert.equal(rewriteCopy({ slug: 'k', title: 'K', actors: 'A', runtime_minutes: 17, tags: 'Hardcore', description: d, seo_description: '', seo_title: '' }).mode.description, 'keep')
  },
  // two rows with the same cast, runtime and tags still get different search descriptions
  () => {
    const mk = (slug, title) => ({ slug, title, actors: 'A One', runtime_minutes: 20, tags: 'Hardcore, Blowjob', source: 'Eporner', seo_description: 'Free HD scene' })
    const used = new Set()
    const a = rewriteCopy(mk('one', 'A One – First'), used).seo_description
    used.add(a.toLowerCase())
    const b = rewriteCopy(mk('two', 'A One – Second'), used).seo_description
    assert.notEqual(a, b)
  },
]
let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 3).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
