// node scripts/test-link-import.mjs — the link tool's logic (scripts/lib/linkImport.mjs), offline
import assert from 'node:assert/strict'
import { LIMITS, canAdd, checkRow, cleanSourceTitle, defaultInclude, draftRow, hasPhrase, mendRow, parseLink, parseListPage, parseWatchPage, redraftRow, rowsToSql, seoChecklist, suggestFocus, videoTags } from './lib/linkImport.mjs'

const site = (extra = {}) => ({
  channels: new Map([['brazzers', 'Brazzers'], ['jav-movies', 'JAV Movies']]),
  freeAllowed: new Map([['kissing', 'Kissing']]),
  taken: { slug: new Set(), title: new Set(), seo_title: new Set(), seo_description: new Set() },
  codes: new Set(),
  removed: new Set(),
  ...extra,
})
const item = (cls, id, code, time) => `<div class="${cls}" data-id="${id}" data-vp="x"><a href="/video-${code}/name/">x</a><span class="mbtim" title="Duration">${time}</span></div>`
const watchHtml = ({ cast = [], cats = [], quality = '1080p, 720p', duration = '50:26', title = 'Scene - EPORNER', channel = '' } = {}) => `
<meta name="description" content="Watch it. Starring: x. Duration: ${duration}, available in: ${quality}. Eporner is the largest hd porn source.">
<meta property="og:title" content="${title}">
${channel}
${cast.map(([n, g]) => `<li class="vit-pornstar"><a href="/pornstar/x/" title="${n} (${g})">${n}</a></li>`).join('')}
${cats.map((c) => `<li class="vit-category"><a href="/cat/${c}/">${c}</a></li>`).join('')}`
const api = (o = {}) => ({ id: 'abcDEF12345', title: 'Vaginal Sex Is Prohibited', keywords: 'anal, big ass, redhead', length_sec: 3026, added: '2026-07-14 05:42:14', embed: 'https://www.eporner.com/embed/abcDEF12345/', default_thumb: { src: 'https://static-eu-cdn.eporner.com/thumbs/static4/1/17/176/17675358/14_240.jpg' }, ...o })
const READY = { tickAll: false, skipBlowjob: true } // the "Tick only ready videos" option
const TEEN = /\b(?:teens?|petite|young|college|students?)\b/i
const splitHas = (list, word) => String(list).split(',').some((k) => k.trim().toLowerCase() === word.toLowerCase())

const cases = [
  // links
  () => assert.deepEqual(parseLink('https://www.eporner.com/video-po2SPyTrVpk/pppe-062/'), { kind: 'video', code: 'po2SPyTrVpk', url: 'https://www.eporner.com/video-po2SPyTrVpk/' }),
  () => assert.equal(parseLink('https://www.eporner.com/hd-porn/RqlBEd2bq41/Lucy-Li/').code, 'RqlBEd2bq41'),
  () => assert.equal(parseLink('https://www.eporner.com/embed/RqlBEd2bq41/').code, 'RqlBEd2bq41'),
  () => assert.deepEqual(parseLink('https://www.eporner.com/profile/PRMITTER42/playlist/LiSIuWvOZUl/Beautiful-Boobs/?x=1'), { kind: 'list', what: 'playlist', url: 'https://www.eporner.com/profile/PRMITTER42/playlist/LiSIuWvOZUl/Beautiful-Boobs/' }),
  () => assert.equal(parseLink('https://eporner.com/profile/PRMITTER42/').url, 'https://www.eporner.com/profile/PRMITTER42/uploaded-videos/'),
  () => assert.equal(parseLink('https://www.eporner.com/tag/japanese-big-tits/top-monthly/').url, 'https://www.eporner.com/tag/japanese-big-tits/top-monthly/'),
  () => assert.equal(parseLink('https://www.eporner.com/pornstar/lucy-li').what, 'pornstar'),
  () => assert.equal(parseLink('https://www.eporner.com/cat/lesbians/').what, 'cat'),
  () => assert.equal(parseLink('https://vexn.org/movie/x'), null),
  () => assert.equal(parseLink('not a link'), null),
  // list pages: both item classes, only the main block, the next page
  () => {
    const html = `<link rel="next" href="https://www.eporner.com/cat/x/2/"><div class="sidebar">${item('mb', 1, 'SIDEbar0001', '30:00')}</div><div id="vidresults">${item('mb hdy', 2, 'HDvideo0001', '42:11')}${item('mb', 3, 'SDvideo0002', '1:02:03')}${item('mb hdy', 4, 'HDvideo0001', '42:11')}</div><div class="numlist2"></div>${item('mb', 5, 'AFTERlist01', '20:00')}`
    const { items, next } = parseListPage(html)
    assert.deepEqual(items, [{ code: 'HDvideo0001', sec: 2531 }, { code: 'SDvideo0002', sec: 3723 }])
    assert.equal(next, 'https://www.eporner.com/cat/x/2/')
  },
  () => assert.deepEqual(parseListPage(`<div class="streamevents pf-act">${item('mb hdy', 1, 'PLAYlist001', '19:50')}</div><div class="numlist2">`).items, [{ code: 'PLAYlist001', sec: 1190 }]),
  // the watch page
  () => {
    const w = parseWatchPage(watchHtml({ cast: [['Charlie Dean', 'Male'], ['Leya Desantis', 'Female']], cats: ['anal', 'teens'], quality: '2160p, 1440p, 1080p', title: 'Lucy Li &amp; Paula Shy - Fin@lly 2gether [4K] - EPORNER', channel: '<li class="vit-channel"><a href="/channel/brazzers/" title="Channel">Brazzers</a></li>' }))
    assert.equal(w.title, 'Lucy Li & Paula Shy - Fin@lly 2gether [4K]')
    assert.deepEqual(w.cast.map((c) => c.name), ['Charlie Dean', 'Leya Desantis'])
    assert.deepEqual(w.categories, ['anal', 'teens'])
    assert.equal(w.maxQuality, 2160)
    assert.deepEqual(w.channel, { slug: 'brazzers', name: 'Brazzers' })
    assert.equal(w.dead, false)
  },
  () => assert.equal(parseWatchPage('').dead, true),
  () => assert.equal(cleanSourceTitle('Kiss To Face - Morgan [4K]'), 'Kiss To Face - Morgan'),
  () => assert.equal(cleanSourceTitle('Watch Lana Rhoades Interracial'), 'Lana Rhoades Interracial'),
  // tags: categories mapped, teen words never kept, blowjob only when the video is one, HD/4K as a label at the end
  () => assert.deepEqual(videoTags({ categories: ['lesbians', 'teens', 'big-tits', 'petite', 'for-women', 'pornstar'], keywords: 'kissing', maxQuality: 2160 }, new Map([['kissing', 'Kissing']])), ['Big Tits', 'Lesbian', 'Kissing', '4K']),
  () => assert.ok(!videoTags({ categories: ['blowjob', 'anal'] }).includes('Blowjob')),
  () => assert.ok(videoTags({ categories: ['blowjob', 'anal'], blowjob: true }).includes('Blowjob')),
  // a draft: every field filled, lengths in range, women first, no teen word even when Eporner files it under Teens
  () => {
    const r = draftRow({ code: 'abcDEF12345', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Charlie Dean', 'Male'], ['Leya Desantis', 'Female']], cats: ['anal', 'big-ass', 'redhead', 'teens', 'small-tits'] })) }, site())
    assert.equal(r.title, 'Leya Desantis & Charlie Dean – Vaginal Sex Is Prohibited (50 Min)')
    assert.equal(r.actors, 'Leya Desantis, Charlie Dean')
    assert.equal(r.channel, 'VEXN')
    assert.equal(r.runtime_minutes, 50)
    assert.equal(r.poster_url, 'https://imggen.eporner.com/17675358/1280/720/14.jpg')
    for (const [k, [lo, hi]] of Object.entries(LIMITS)) assert.ok(r[k].length >= lo && r[k].length <= hi, `${k} ${r[k].length}: ${r[k]}`)
    assert.ok(!TEEN.test([r.title, r.slug, r.tags, r.keywords, r.description, r.seo_title, r.seo_description].join(' ')))
    assert.equal(r.flags.teenSource, 'teens')
    const c = checkRow(r, site())
    assert.deepEqual(c.errors, [])
    assert.ok(c.warnings.some((w) => w.includes('Teens') || w.includes('teens')))
    assert.equal(defaultInclude(r, c, READY), true)
  },
  // a JAV product code with no cast: the code stays as written and the film goes to JAV Movies
  () => {
    const r = draftRow({ code: 'po2SPyTrVpk', api: api({ title: 'PPPE-062', keywords: ', asian, PPPE-062', length_sec: 8244 }), watch: parseWatchPage(watchHtml({ cats: ['blowjob', 'asian', 'brunette'], duration: '137:24' })) }, site())
    assert.equal(r.title, 'PPPE-062 – Japanese JAV Movie (137 Min)')
    assert.equal(r.channel, 'JAV Movies')
    assert.ok(r.slug.startsWith('pppe-062-japanese-jav-movie'))
    assert.ok(r.tags.startsWith('Jav, Japanese'))
    assert.equal(r.flags.blowjob, true)
    const c = checkRow(r, site())
    assert.deepEqual(c.errors, [])
    assert.equal(defaultInclude(r, c, READY), false) // "only ready videos": held by the blowjob rule
    assert.equal(defaultInclude(r, c), true) // default: every drafted video is ticked
    assert.equal(defaultInclude(r, c, { ...READY, skipBlowjob: false }), true)
  },
  // a studio channel the site has
  () => assert.equal(draftRow({ code: 'x', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']], channel: '<li class="vit-channel"><a href="/channel/brazzers/" title="Channel">Brazzers</a></li>' })) }, site()).channel, 'Brazzers'),
  // taken addresses and titles are avoided; a taken code, a teen word, a duplicate inside the batch are errors
  () => {
    const s = site()
    const first = draftRow({ code: 'abcDEF12345', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']] })) }, s)
    s.taken.slug.add(first.slug)
    s.taken.seo_title.add(first.seo_title.toLowerCase())
    const second = draftRow({ code: 'abcDEF12345', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']] })) }, s)
    assert.notEqual(second.slug, first.slug)
    assert.notEqual(second.seo_title, first.seo_title)
  },
  () => {
    const r = draftRow({ code: 'abcDEF12345', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']] })) }, site())
    assert.ok(checkRow(r, site({ codes: new Set(['abcDEF12345']) })).errors.includes('already on the site'))
    assert.ok(checkRow({ ...r, title: 'Teen Fun (50 Min)' }, site()).errors.some((e) => e.startsWith('teen-type word')))
    assert.ok(checkRow({ ...r, seo_title: 'Too short' }, site()).fixes.some((e) => e.startsWith('seo title is 9')))
    const twin = { ...r, code: 'other123456' }
    assert.ok(checkRow(r, site(), [r, twin]).errors.some((e) => e.startsWith('same address')))
  },
  // keywords: a phrase matches whole words in order, any case or punctuation
  () => {
    assert.ok(hasPhrase('Lucy Li Big Tits – ITC Solo 02', 'lucy li big tits'))
    assert.ok(hasPhrase('pppe-062-japanese-jav-movie', 'PPPE-062'))
    assert.ok(!hasPhrase('Lucy Lion', 'Lucy Li'))
    assert.equal(suggestFocus({ cast: ['Lucy Li'], main: 'Big Tits' }), 'Lucy Li big tits')
    assert.equal(suggestFocus({ cast: [], main: 'Lesbian' }), 'free lesbian video')
    assert.equal(suggestFocus({ javCode: 'PPPE-062', main: 'Jav' }), 'PPPE-062')
  },
  // a draft carries its focus phrase in every text and in the keywords, and its checklist is all ticked
  () => {
    const r = draftRow({ code: 'abcDEF12345', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']], cats: ['anal', 'big-ass', 'redhead'] })) }, site())
    assert.equal(r.focus, 'Leya Desantis anal')
    for (const k of ['seo_title', 'seo_description', 'description', 'keywords']) assert.ok(hasPhrase(r[k], r.focus), `${k}: ${r[k]}`)
    const list = seoChecklist(r, { site: site() })
    assert.deepEqual(list.items.filter((i) => !i.ok).map((i) => i.label), [])
  },
  // extra keywords are worked in where they fit, and each one has its line in the checklist
  () => {
    const r = draftRow({ code: 'abcDEF12345', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']], cats: ['anal', 'big-ass'] })) }, site(), { extras: ['free anal porn', 'full HD video'] })
    for (const [k, [lo, hi]] of Object.entries(LIMITS)) assert.ok(r[k].length >= lo && r[k].length <= hi, `${k} ${r[k].length}: ${r[k]}`)
    assert.ok(['seo_title', 'seo_description', 'description'].some((k) => hasPhrase(r[k], 'free anal porn')))
    assert.ok(hasPhrase(r.keywords, 'full HD video'))
    const list = seoChecklist(r, { extras: ['free anal porn', 'full HD video'], site: site() })
    assert.ok(list.items.some((i) => i.label === '“free anal porn”' && i.ok))
    assert.equal(list.total, list.items.length)
  },
  // a new focus phrase rewrites the texts from the card's own fields; the old phrase leaves the keywords
  () => {
    const r = draftRow({ code: 'abcDEF12345', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']], cats: ['anal', 'redhead'], quality: '2160p' })) }, site())
    const next = redraftRow({ ...r, focus: 'Leya Desantis 4K anal', actors: 'Leya Desantis, Charlie Dean' }, { extras: [] })
    assert.ok(hasPhrase(next.seo_title, 'Leya Desantis 4K anal') || hasPhrase(next.seo_description, 'Leya Desantis 4K anal'))
    assert.ok(hasPhrase(next.description, 'Charlie Dean'))
    assert.ok(hasPhrase(next.keywords, 'Leya Desantis 4K anal'))
    assert.ok(!splitHas(next.keywords, 'Leya Desantis anal'))
    const missing = seoChecklist({ ...r, focus: 'Lucy Li' }, { site: site() })
    assert.ok(missing.items.some((i) => i.label === 'Focus keyword in the search title' && !i.ok))
  },
  // the importers' guard: a family title is an error and is not ticked; reworded, it stays a warning and unticked
  () => {
    const r = draftRow({ code: 'ftk2zUbqs1u', api: api({ title: 'PD - Family P1', keywords: 'big tits, blonde', length_sec: 1500 }), watch: parseWatchPage(watchHtml({ cats: ['big-tits', 'blonde'], duration: '25:00' })) }, site())
    assert.equal(r.flags.guard, 'Family')
    const c = checkRow(r, site())
    assert.ok(c.fixes.some((e) => e.startsWith('site rule: "Family"')), c.fixes.join('; '))
    assert.equal(canAdd(c), true) // the owner may add it by ticking it
    assert.equal(defaultInclude(r, c, READY), false)
    const reworded = { ...r, title: 'PD – Part One (25 Min)', slug: 'pd-part-one-big-tits', seo_title: 'PD Part One – Free Big Tits Video in HD Quality', seo_description: r.seo_description.replace(/Family P1/g, 'Part One'), description: r.description.replace(/Family P1/g, 'Part One'), keywords: 'Big Tits, Blonde', focus: '' }
    const c2 = checkRow(reworded, site())
    assert.ok(!c2.fixes.some((e) => e.startsWith('site rule')), c2.fixes.join('; '))
    assert.ok(c2.warnings.some((w) => w.includes('the source says "Family"')))
    assert.equal(defaultInclude(reworded, c2, READY), false)
  },
  // what a tick can override (lengths, reused wording, review words) and what it cannot (block rules, broken rows)
  () => {
    const r = draftRow({ code: 'abcDEF12345', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']] })) }, site())
    const short = checkRow({ ...r, seo_title: 'Short', description: 'Too short.' }, site())
    assert.deepEqual(short.errors, [])
    assert.ok(short.fixes.length >= 2 && canAdd(short) && !defaultInclude(r, short, READY))
    const reused = checkRow(r, site({ taken: { slug: new Set(), title: new Set([r.title.toLowerCase()]), seo_title: new Set(), seo_description: new Set() } }))
    assert.ok(canAdd(reused) && reused.fixes.includes('another video has this title'))
    const review = checkRow({ ...r, title: 'Sleeping Beauty Scene (50 Min)' }, site())
    assert.ok(canAdd(review) && review.fixes.some((f) => f.includes('sleeping')))
    for (const [field, value] of [['title', 'Teen Fun (50 Min)'], ['title', 'Forced Scene (50 Min)'], ['description', `${r.description} A stepmom story.`], ['title', 'High School Prom (50 Min)'], ['slug', 'Bad Address'], ['title', '']]) {
      assert.equal(canAdd(checkRow({ ...r, [field]: value }, site())), false, `${field}: ${value}`)
    }
    assert.equal(canAdd(checkRow(r, site({ codes: new Set(['abcDEF12345']) }))), false)
  },
  // "Petite" is a tag, except next to a Teens category
  () => {
    assert.ok(videoTags({ categories: ['petite', 'blonde'] }).includes('Petite'))
    assert.ok(!videoTags({ categories: ['teens', 'petite', 'blonde'] }).includes('Petite'))
  },
  // what Eporner says counts: a "stepmom" category or an Indonesian in-law word blocks the video, whatever its title
  () => {
    const step = draftRow({ code: 'uYFuXlzzh9o', api: api({ title: 'That Looks Mighty Big, Spikey!', length_sec: 480 }), watch: parseWatchPage(watchHtml({ cast: [['Lilly James', 'Female']], cats: ['milf', 'blonde', 'stepmom'], duration: '8:00' })) }, site())
    assert.equal(step.flags.sourceBlock, 'stepmom')
    assert.equal(canAdd(checkRow(step, site())), false)
    const inlaw = draftRow({ code: '3s5tS6XgYNQ', api: api({ title: 'AI Baru Mertuaku Sangat Baik', length_sec: 600 }), watch: parseWatchPage(watchHtml({ cats: ['asian', 'milf', 'ai'], duration: '10:00' })) }, site())
    assert.equal(canAdd(checkRow(inlaw, site())), false)
    assert.ok(!draftRow({ code: 'x', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']], cats: ['anal', 'teens'] })) }, site()).flags.sourceBlock) // Teens: the neutral-wording case
  },
  // an AI video: AI Movie channel, the AI Generated tag, "AI Generated" once in the title, an address ending -ai-generated
  () => {
    const s = site({ channels: new Map([['ai-movie', 'AI Movie']]) })
    const r = draftRow({ code: 'LQzwrr8tz2x', api: api({ title: 'Big Tit Threesome &amp; Double Blowjobs ~ AI-Generated', length_sec: 720 }), watch: parseWatchPage(watchHtml({ cats: ['threesome', 'big-tits', 'ai'], duration: '12:00' })) }, s)
    assert.equal(r.channel, 'AI Movie')
    assert.ok(r.tags.startsWith('AI Generated'))
    assert.equal(r.title, 'Big Tit Threesome & Double Blowjobs – AI Generated (12 Min)')
    assert.ok(r.slug.endsWith('-ai-generated') && !r.slug.startsWith('free-'))
    assert.ok(/AI-generated/i.test(r.seo_title + r.seo_description))
    assert.equal(cleanSourceTitle('AI CHina Girl Sexxy'), 'AI China Girl Sexxy')
  },
  // "an 8-minute", never "a 8-minute"
  () => {
    const r = draftRow({ code: 'x', api: api({ length_sec: 480 }), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']], duration: '8:00' })) }, site())
    for (const k of ['seo_description', 'description']) assert.ok(!/\ba 8-minute/.test(r[k]), r[k])
  },
  // all in: broken fields are mended so a ticked row always inserts; notes become "-- CHECK" lines above the row
  () => {
    const r = draftRow({ code: 'abcDEF12345', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']] })) }, site())
    const s = site()
    s.taken.slug.add(r.slug)
    const used = new Set()
    const a = mendRow(r, s, used)
    assert.equal(a.row.slug, `${r.slug}-abcdef12345`)
    const b = mendRow({ ...r, code: 'zzz', slug: 'Bad Address!', title: '' , source_title: 'Source Name' }, s, used)
    assert.equal(b.row.title, 'Source Name')
    assert.equal(b.row.slug, 'bad-address')
    assert.ok(b.changes.length === 2)
    const sql = rowsToSql([{ ...a.row, notes: ['RULE Eporner files it under "stepmom"', 'seo title is 9 characters (30-53)'] }, b.row])
    assert.ok(sql.includes('-- CHECK '))
    assert.ok(sql.includes('RULE Eporner files it under "stepmom"; seo title is 9 characters (30-53)'))
    assert.ok(sql.includes('1 marked CHECK below need the second check'))
    assert.equal((sql.match(/^\s+\(\$q\$/gm) || []).length, 2) // both rows are in
  },
  // SQL: one insert, dollar-quoted text, nulls for empty fields, the first row newest
  () => {
    const r = draftRow({ code: 'abcDEF12345', api: api(), watch: parseWatchPage(watchHtml({ cast: [['Leya Desantis', 'Female']] })) }, site())
    const sql = rowsToSql([{ ...r, description: 'It costs $q$ nothing' }, { ...r, slug: 'b', actors: '' }])
    assert.ok(sql.includes('insert into public.movies (title, slug, poster_url, trailer_url, description, keywords, tags, actors, channel, runtime_minutes, seo_title, seo_description, featured, created_at, source, source_published_at)'))
    assert.ok(sql.includes('$qq$It costs $q$ nothing$qq$'))
    assert.ok(sql.includes("now() - interval '0 seconds'") && sql.includes("now() - interval '1 seconds'"))
    assert.ok(sql.includes(', null, $q$VEXN$q$'))
    assert.ok(sql.trim().endsWith('on conflict (slug) do nothing\nreturning slug;'))
  },
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 4).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
