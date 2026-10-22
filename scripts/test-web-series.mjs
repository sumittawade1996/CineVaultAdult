// node scripts/test-web-series.mjs
import assert from 'node:assert/strict'
import { CHANNELS, buildDescription, buildKeywords, buildSeoDescription, buildSeoTitle, buildSlug, buildTitle, excludeReason, fixText, parseTitle, tagsFor, usableSeries } from './lib/webSeries.mjs'
import { checkContent } from '../src/lib/contentRules.js'

const U = CHANNELS.ullu
const F = CHANNELS['fliz-movies']
const R = CHANNELS['rabbit-movies']
const long = { length_sec: 30 * 60, keywords: 'indian, housewives' }
const label = (raw, ch = U) => { const p = parseTitle(raw, ch); return `${p.series} | ${p.year || '-'} | ${p.label || '-'} | ${p.language}` }

const cases = [
  // ---- who qualifies
  () => assert.equal(excludeReason({ ...long, title: '(ULLU) The Bucket List Part 2 E03' }, U), null),
  () => assert.equal(excludeReason({ ...long, length_sec: 19 * 60, title: 'Parda Hai Parda Part 1 Ullu' }, U), 'under 20 minutes'),
  () => assert.match(excludeReason({ ...long, length_sec: 291 * 60, title: 'Tadap Season 1 Ullu' }, U), /over 120/),
  () => assert.equal(excludeReason({ ...long, title: 'Some Other Series Part 1' }, U), 'channel not named in the title'),
  () => assert.equal(excludeReason({ ...long, title: 'Rabbit hole Part 1' }, R), 'channel not named in the title'), // the word alone is not the channel
  () => assert.match(excludeReason({ ...long, title: 'BanGLamov Ie Saltlake BTS Fliz Webseries' }, F), /not an episode/),
  // forced, family and in-law words, in Hindi too
  () => assert.match(excludeReason({ ...long, title: 'Thakur ne sexy biwi ko jabardasti gand mara Ullu Indian web series' }, U), /scene-description|guard/),
  () => assert.match(excludeReason({ ...long, title: 'Mummy Ki Dost S01 E01 Ullu' }, U), /guard: Mummy/),
  () => assert.match(excludeReason({ ...long, title: 'Dever Bhabhi Ullu webseries' }, U), /guard: Dever/),
  () => assert.match(excludeReason({ ...long, title: 'Bhabhi Sex with Father in low ULLU Hot Hindi Adult Web Series' }, U), /guard/),
  () => assert.match(excludeReason({ ...long, title: 'Vashikarn Episode 7 Ullu Original' }, U), /guard: Vashikarn/),
  () => assert.match(excludeReason({ ...long, title: 'Estate Manager S01E04 Ullu', keywords: 'indian, teens' }, U), /content rule: teens/),
  // no blowjob videos
  () => assert.equal(excludeReason({ ...long, title: 'Kitty Party Part 01 Ullu', keywords: 'indian, blowjob' }, U), 'blowjob'),
  // a long Hindi sentence is the scene's description, not a series title
  () => assert.equal(excludeReason({ ...long, title: 'Pati ne sexy biwi ko tel lagake gand mara. Ullu indian web series. Nurse episode 1.' }, U), 'scene-description title'),

  // ---- messy titles become series, year, episode
  () => assert.equal(label('(ULLU) The Bucket List Part 2 E03'), 'The Bucket List | - | Part 2 EP03 | Hindi'),
  () => assert.equal(label('Desix11.Com Nurse   E06 (2024)   Ullu Hindi Hot Web Series Watch Free Pornx11'), 'Nurse | 2024 | EP06 | Hindi'),
  () => assert.equal(label('Parda hai parda part 1 ullu web series'), 'Parda Hai Parda | - | Part 1 | Hindi'),
  () => assert.equal(label('New ullu indian web series 2022. Walkman S1 episode 7-9'), 'Walkman | 2022 | S01E07-09 | Hindi'),
  () => assert.equal(label('Kavita bhabhi season 3 part 2 ullu web series'), 'Kavita Bhabhi | - | S03 Part 2 | Hindi'),
  () => assert.equal(label('Farebi-Ishq-(2024)-Season-01-Part-1-Hindi-ULLU-Web-Series'), 'Farebi Ishq | 2024 | S01 Part 1 | Hindi'),
  () => assert.equal(label('Love. Bite. Ullu. S01. P02. 720p'), 'Love Bite | - | S01 Part 2 | Hindi'),
  () => assert.equal(label('Manmaniyan-Part-1-(2023)-Ullu-Hindi-Web-Series--720p- HdMaal .mp4...'), 'Manmaniyan | 2023 | Part 1 | Hindi'),
  () => assert.equal(label('Tohfa P01 EP1 ULLU Hot Hindi Web Series'), 'Tohfa | - | Part 1 EP01 | Hindi'),
  () => assert.equal(label('Bharti Jha Ullu Aaha Se Aha Tak ep 5'), 'Bharti Jha Aaha Se Aha Tak | - | EP05 | Hindi'),
  () => assert.equal(label('Namak (2023) S01 EP(01-06) Tamil ULLU'), 'Namak | 2023 | S01E01-06 | Tamil'),
  () => assert.equal(label('Lalmirch Part2 (2024) Ullu web series'), 'Lalmirch | 2024 | Part 2 | Hindi'),
  () => assert.equal(label('Ullu Dream girl ullu romantic web series fucking'), 'Dream Girl | - | - | Hindi'),
  () => assert.equal(label('hot romance ullu Web series').split(' | ')[0], ''), // nothing but noise: no series name
  () => assert.equal(label('Ullu webseries').split(' | ')[0], ''),
  () => assert.equal(label('Sexy Indian lesbian hotel sex. Ullu indian web series. Anokha Rishta E3'), 'Anokha Rishta | - | EP03 | Hindi'), // the series follows "web series"
  () => assert.equal(label('Aah se Aaha tak part 2 ullu web series full movie'), 'Aah Se Aaha Tak | - | Part 2 | Hindi'),
  () => assert.equal(label('De de pyar de part 1 ullu webseries full videos hot romance'), 'De De Pyar De | - | Part 1 | Hindi'), // short words may repeat
  () => assert.equal(label('Ullu indian web series, Rajshot').split(' | ')[0], ''), // an uploader's name, not a series
  // Fliz and Rabbit
  () => assert.equal(label('Uploading Sarla bhabhi s03e01 flizmovies HD.mp4... Speed: 52.11 Mbps', F), 'Sarla Bhabhi | - | S03E01 | Hindi'),
  () => assert.equal(label('Rasam S01e03 Tamil Flizmovies Web Series', F), 'Rasam | - | S01E03 | Tamil'),
  () => assert.equal(label('Rosgulla â\u0080\u0093 S01E02 â\u0080\u0093 2020 â\u0080\u0093 Hindi Hot Web Series â\u0080\u0093 Fliz Movies', F), 'Rosgulla | 2020 | S01E02 | Hindi'),
  () => assert.equal(label('Rose marlo 2023 ep07-08 rabbit movies', R), 'Rose Marlo | 2023 | EP07-08 | Hindi'),
  () => assert.equal(label('New Jalebi Hindi Season 4 Episode 7-8 Rabbit Movies Exclusive Series.mp4', R), 'Jalebi | - | S04E07-08 | Hindi'),
  () => assert.equal(label('Lodam bhabhi rabbit movies', R), 'Lodam Bhabhi | - | - | Hindi'),
  () => assert.equal(fixText('Tohfa EP1 ULLU Hot Hindi Web Series ð\u009f\u0094¥'), 'Tohfa EP1 ULLU Hot Hindi Web Series'),
  () => assert.ok(usableSeries('Parda Hai Parda') && !usableSeries('') && !usableSeries('Pati Ne Sexy Biwi Ko Tel Lagake Gand Mara')),

  // ---- titles, slug, tags, search texts
  () => {
    const p = parseTitle('(ULLU) The Bucket List Part 2 E03', U)
    assert.equal(buildTitle(p, U, 29), 'The Bucket List Part 2 EP03 – Hindi Ullu Web Series (29 Min)')
    assert.equal(buildSlug(p, U), 'the-bucket-list-part-2-ep03-hindi-ullu-web-series')
    assert.equal(buildSeoTitle(p, U, 29), 'The Bucket List Part 2 EP03 – Hindi Ullu Web Series')
  },
  () => {
    const tags = tagsFor({ keywords: 'big tits, indian, milf, lingerie, striptease, amateur, asian porn', title: '(ULLU) The Bucket List Part 2 E03', language: 'Hindi', channel: U })
    assert.equal(tags, 'Indian, Web Series, Desi, Hindi, Ullu, Big Tits, MILF, Lingerie') // searched most first (Big Tits 100, MILF 85): no Amateur, no Asian
  },
  () => assert.match(tagsFor({ keywords: 'indian', title: 'Rain Basera Part 2 ullu webseries hot romance', language: 'Hindi', channel: U }), /Romantic/),
  () => assert.match(tagsFor({ keywords: 'indian', title: 'Kavita bhabhi season 3 part 2 ullu web series', language: 'Hindi', channel: U }), /Bhabhi/),
  () => {
    const samples = [
      ['(ULLU) The Bucket List Part 2 E03', U, 29, 'big tits, indian, milf, lingerie'],
      ['Walkman S1 episode 7-9 ullu', U, 62, 'indian, anal, big dick'],
      ['Parda hai parda part 1 ullu web series', U, 75, 'indian'],
      ['Rose marlo 2023 ep07-08 rabbit movies', R, 39, 'indian'],
      ['Uploading Sarla bhabhi s03e01 flizmovies HD.mp4...', F, 26, 'big tits, brunette, indian'],
      ['Namak (2023) S01 EP(01-06) Tamil ULLU', U, 100, 'housewives'],
      ['Aah se Aaha tak Ullu', U, 78, 'indian'],
    ]
    for (const [raw, ch, minutes, kw] of samples) {
      const p = parseTitle(raw, ch, kw)
      const slug = buildSlug(p, ch)
      const tags = tagsFor({ keywords: kw, title: raw, language: p.language, channel: ch }).split(', ')
      const st = buildSeoTitle(p, ch, minutes)
      const sd = buildSeoDescription({ slug, p, channel: ch, minutes, tags })
      const d = buildDescription({ slug, p, channel: ch, minutes, tags })
      assert.ok(st.length >= 30 && st.length <= 53 && st.includes(ch.name), `seo_title ${st.length}: ${st}`)
      assert.ok(sd.length >= 140 && sd.length <= 160, `seo_description ${sd.length}: ${sd}`)
      assert.ok(/indian/i.test(sd) && /desi/i.test(sd) && sd.includes(ch.name) && sd.includes(String(minutes)), `trend words, channel and length missing: ${sd}`)
      assert.ok(d.length >= 200 && d.length <= 450, `description ${d.length}: ${d}`)
      assert.equal(checkContent({ title: buildTitle(p, ch, minutes), slug, tags: tags.join(', '), description: `${d} ${sd} ${st}` }).block.length, 0)
      assert.ok(!/\b(?:hd|free|best|steamy|viral|trending|blowjob)\b/i.test(`${st} ${sd} ${d}`), `claim or banned word: ${st} | ${sd} | ${d}`)
    }
  },
  // the same upload always gets the same text; two different episodes get different ones
  () => {
    const p1 = parseTitle('Parda hai parda part 1 ullu', U)
    const p2 = parseTitle('Parda hai parda part 2 ullu', U)
    const mk = (p, slug) => buildSeoDescription({ slug, p, channel: U, minutes: 75, tags: ['Indian', 'Web Series', 'Desi', 'Hindi', 'Ullu'] })
    assert.equal(mk(p1, 'a'), mk(p1, 'a'))
    assert.notEqual(mk(p1, 'a'), mk(p2, 'b'))
  },
  () => assert.equal(buildKeywords({ p: parseTitle('Parda hai parda part 1 ullu', U), channel: U, tags: ['Indian', 'Web Series', 'Desi', 'Hindi', 'Ullu'] }), 'Ullu, Parda Hai Parda, Hindi web series, Indian, Web Series, Desi, Hindi'),
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 4).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
