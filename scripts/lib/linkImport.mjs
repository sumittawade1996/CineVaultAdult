// Pure logic for the link tool (scripts/link-tool/server.mjs, `npm run link-tool`): which Eporner page a link is,
// how its pages are read, and how one video becomes a draft row with every column of public.movies. No network here,
// so all of it is tested offline (scripts/test-link-import.mjs).
//
// A draft is only a start: the tool shows every field for editing and checks it again before writing SQL. The rules
// are the importers' (20+ minutes, the site's content rules, search title 30-53 characters, search description
// 140-160, page description 200-450, nothing that is already on the site) and two owner decisions:
//   - blowjob videos are held unless the owner ticks them (rule of 18 Oct 2026, "add all" overrides per video)
//   - a video Eporner files under Teens can be added with neutral wording: no teen-type word in any field (13 Nov 2026)
import { slugify } from '../../src/lib/slugify.js'
import { checkContent } from '../../src/lib/contentRules.js'
import { CONTROLLED_BY_SLUG, LABEL_TAGS, TAG_ALIASES } from '../../src/lib/categories.js'
import { COMPILATION, EXTRA_BLOCK, OFF_SCOPE, TREND, cleanCast, clipWords, mentionsBlowjob, posterFrom, sceneTitle } from './studioImport.mjs'
import { dropReversedNames } from './tagImport.mjs'
import { aOrAn, listJoin } from './movieCopy.mjs'

export { posterFrom }
export const MIN_MINUTES = 20
export const MAX_MINUTES = 240
export const LIMITS = { seo_title: [30, 53], seo_description: [140, 160], description: [200, 450] }
const ORIGIN = 'https://www.eporner.com'

// ---- links ------------------------------------------------------------------------------------------------------
// -> { kind: 'video', code, url } | { kind: 'list', what, url } | null (not an Eporner page the tool can read)
export function parseLink(input) {
  let u
  try { u = new URL(String(input || '').trim()) } catch { return null }
  if (!/(^|\.)eporner\.com$/i.test(u.hostname)) return null
  const p = u.pathname.split('/').filter(Boolean)
  const video = (p[0] || '').match(/^video-([A-Za-z0-9]{5,20})$/)
  if (video) return { kind: 'video', code: video[1], url: `${ORIGIN}/video-${video[1]}/` }
  if (['hd-porn', 'embed'].includes(p[0]) && /^[A-Za-z0-9]{5,20}$/.test(p[1] || '')) return { kind: 'video', code: p[1], url: `${ORIGIN}/video-${p[1]}/` }
  if (p[0] === 'profile' && p[1]) {
    if (p[2] === 'playlist' && p[3]) return { kind: 'list', what: 'playlist', url: `${ORIGIN}/${p.slice(0, 5).join('/')}/` }
    // a profile's front page shows shelves; its uploads are a normal list
    const rest = p[2] === 'uploaded-videos' ? p.slice(3) : []
    return { kind: 'list', what: 'uploads', url: `${ORIGIN}/profile/${p[1]}/uploaded-videos/${rest.map((s) => `${s}/`).join('')}` }
  }
  if (['tag', 'pornstar', 'channel', 'cat', 'search'].includes(p[0]) && p[1]) return { kind: 'list', what: p[0], url: `${ORIGIN}/${p.join('/')}/` }
  return null
}

// ---- pages ------------------------------------------------------------------------------------------------------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export const decodeEntities = (s) => String(s || '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)

const toSec = (t) => { const p = String(t).trim().split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + (p[1] || 0) }

// The videos of one list page, in its own order, and the address of the next page. Every list kind keeps its videos
// in one block (#vidresults, #vidresultstop on channels, .streamevents on playlists, #pf-shelf-videos on profiles)
// that ends at the page numbers; outside it are "related" and sidebar videos, which are not the list's.
// Both item classes count: "mb" and "mb hdy" (the HD ones).
export function parseListPage(html) {
  const marks = ['id="vidresults"', 'id="vidresultstop"', 'class="streamevents', 'id="pf-shelf-videos"'].map((m) => html.indexOf(m)).filter((i) => i >= 0)
  const start = marks.length ? Math.min(...marks) : 0
  const endAt = html.indexOf('class="numlist2"', start)
  const part = html.slice(start, endAt < 0 ? undefined : endAt)
  const seen = new Set()
  const items = []
  for (const m of part.matchAll(/<div class="mb(?: [^"]*)?"[^>]*data-id="\d+"[\s\S]*?href="\/video-([A-Za-z0-9]+)\/[^"]*"[\s\S]*?class="mbtim"[^>]*>([^<]+)</g)) {
    if (seen.has(m[1])) continue
    seen.add(m[1])
    items.push({ code: m[1], sec: toSec(m[2]) })
  }
  const next = (html.match(/<link rel="next" href="([^"]+)"/) || [])[1] || null
  return { items, next }
}

// What a video's own page says: the credited cast with gender, the studio channel, Eporner's categories and tags,
// the length and the qualities it plays in. dead: the page says the video is gone.
export function parseWatchPage(html) {
  const h = String(html || '')
  const dead = !h || /This video (?:is no longer available|has been (?:deleted|removed))/i.test(h)
  const meta = decodeEntities((h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '')
  const cast = [...h.matchAll(/<li class="vit-pornstar[^"]*"><a href="\/pornstar\/[^"]+" title="([^"(]+?) \((Female|Male|Trans[^)]*)\)"/g)].map((m) => ({ name: decodeEntities(m[1]).trim(), gender: m[2] }))
  const ch = h.match(/<li class="vit-channel"><a href="\/channel\/([^"]+)\/" title="Channel">([^<]+)<\/a>/)
  const qualities = ((meta.match(/available in: ([^.]+?)(?:\. |$)/) || [])[1] || '').split(',').map((s) => s.trim()).filter(Boolean)
  return {
    dead,
    title: decodeEntities((h.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || '').replace(/\s+-\s+EPORNER\s*$/i, '').trim(),
    cast,
    channel: ch ? { slug: ch[1], name: decodeEntities(ch[2]).trim() } : null,
    categories: [...h.matchAll(/<li class="vit-category"><a href="\/cat\/([^"]+)\//g)].map((m) => m[1]),
    tags: [...h.matchAll(/<li class="vit-tag"><a href="\/tag\/([^"]+)\//g)].map((m) => m[1]),
    duration: (meta.match(/Duration: ([\d:]+)/) || [])[1] || null,
    qualities,
    maxQuality: Math.max(0, ...qualities.map((q) => parseInt(q, 10)).filter(Number.isFinite)),
  }
}

// ---- tags -------------------------------------------------------------------------------------------------------
// Eporner category or keyword (as a slug) -> the site's tag. null = not a topic (a label, a format, a site word).
const SOURCE_TAGS = new Map(Object.entries({
  lesbians: 'Lesbian', lesbian: 'Lesbian', 'big-tits': 'Big Tits', 'big-boobs': 'Big Tits', busty: 'Big Tits', 'natural-tits': 'Big Tits', 'huge-tits': 'Big Tits',
  'big-ass': 'Big Ass', 'big-butt': 'Big Ass', 'big-dick': 'Big Dick', 'big-cock': 'Big Dick', 'monster-cock': 'Big Dick', 'small-tits': 'Small Tits', 'tiny-tits': 'Small Tits',
  milf: 'MILF', pov: 'POV', 'pov-porn': 'POV', bbw: 'BBW', pawg: 'PAWG', orgy: 'Group Sex', gangbang: 'Group Sex', 'group-sex': 'Group Sex', swingers: 'Swinger',
  dp: 'Double Penetration', 'double-penetration': 'Double Penetration', 'oil-massage': 'Massage', japanese: 'Japanese', jav: 'Jav', toys: 'Toys', 'sex-toys': 'Toys',
  'hd-1080p': null, 'hd-sex': null, 'hq-porn': null, '60fps': null, '4k-porn': null, 'vr-porn': null, pornstar: null, 'for-women': null, 'verified-amateurs': null,
  'verified-models': null, 'verified-couples': null, sex: null, porn: null, xxx: null, hd: null, '4k': null,
}))
// Teen-type words: never written into a row (the neutral-wording decision); a source category among them is shown as a flag
export const TEEN_WORDS = /\b(?:teens?|teenagers?|teenie\w*|barely legal|schoolgirls?|school ?girl|students?|college|young(?:er)?|tiny teen|18 ?yo|19 ?yo|jailbait|lolita)\b/i
const TEEN_SOURCE = new Set(['teens', 'teen', 'college', 'school', 'schoolgirl', 'students', 'student', 'young', '18-yo', '19-yo'])
// "Petite" is an adult body type, but next to a Teens category it reads as one more age hint, so it is dropped there
// which tag names the video in the search title and the address, in this order of preference
const MAIN_ORDER = ['Lesbian', 'Threesome', 'Group Sex', 'Interracial', 'Anal', 'Creampie', 'MILF', 'Jav', 'Indian', 'Desi', 'Bhabhi', 'Nuru Massage', 'Massage', 'Squirt', 'Cheating', 'POV', 'Big Tits', 'Big Ass', 'Big Dick', 'Redhead', 'Blonde', 'Brunette', 'Hardcore', 'Masturbation']
const ACRONYM = new Map([['milf', 'MILF'], ['jav', 'JAV'], ['pov', 'POV'], ['bbw', 'BBW'], ['pawg', 'PAWG'], ['4k', '4K'], ['hd', 'HD']])
const PROPER = new Set(['japanese', 'asian', 'indian', 'desi', 'hindi', 'latina', 'bhabhi', 'ebony', 'european', 'russian', 'czech', 'german', 'french', 'british', 'american', 'chinese', 'korean', 'thai', 'filipina', 'arab', 'brazilian', 'colombian'])
export const tagWord = (name, lower = true) => ACRONYM.get(slugify(name)) || (lower && !PROPER.has(slugify(name)) ? name.toLowerCase() : name)

function siteTagFor(raw, freeAllowed) {
  const slug = slugify(raw)
  if (!slug) return undefined
  if (SOURCE_TAGS.has(slug)) return SOURCE_TAGS.get(slug)
  if (TAG_ALIASES.has(slug)) return TAG_ALIASES.get(slug)
  if (CONTROLLED_BY_SLUG.has(slug)) return CONTROLLED_BY_SLUG.get(slug)
  if (LABEL_TAGS.has(slug)) return null
  if (freeAllowed.has(slug)) return freeAllowed.get(slug)
  return undefined
}

// The site's tags for a video: its Eporner categories first (they are chosen from a fixed list), then its keywords,
// mapped to the site's names; the most searched first (TREND), at most `max`, then HD or 4K as a label.
export function videoTags({ categories = [], keywords = '', jav = false, ai = false, blowjob = false, maxQuality = 0, castCount = 0 }, freeAllowed = new Map(), max = 8) {
  const out = []
  const seen = new Set()
  const teenCategory = categories.some((c) => TEEN_SOURCE.has(c))
  const add = (name, at = out.length) => {
    if (!name) return
    const s = slugify(name)
    if (seen.has(s)) return
    if (TEEN_WORDS.test(name) || TEEN_SOURCE.has(s) || (s === 'petite' && teenCategory)) return
    if (/^blow ?jobs?$/i.test(name) && !blowjob) return
    if ((s === 'amateur' || s === 'homemade') && castCount) return // a credited performer: Eporner users add these to almost everything
    seen.add(s)
    out.splice(at, 0, name)
  }
  if (jav) { add('Jav'); add('Japanese') }
  if (ai) add('AI Generated') // the AI Movie channel's own tag
  const rest = []
  for (const raw of [...categories, ...String(keywords).split(',')]) { const name = siteTagFor(raw.trim(), freeAllowed); if (name) rest.push(name) }
  if (blowjob) rest.push('Blowjob')
  const ranked = [...new Set(rest)].map((name, i) => ({ name, i, w: TREND[slugify(name)] || 0 })).sort((a, b) => b.w - a.w || a.i - b.i)
  for (const { name } of ranked) { if (out.length >= max) break; add(name) }
  const label = maxQuality >= 2160 ? '4K' : maxQuality >= 1080 ? 'HD' : null
  const tags = out.slice(0, max)
  if (label) tags.push(label)
  return tags
}

export function mainTagOf(tags) {
  for (const name of MAIN_ORDER) if (tags.includes(name)) return name
  return tags.find((t) => !LABEL_TAGS.has(slugify(t))) || 'Porn'
}

// ---- keywords -----------------------------------------------------------------------------------------------------
// A phrase is "in" a text when its words appear together, in order, ignoring case and punctuation
// ("Lucy Li big tits" is in "Lucy Li Big Tits – ITC Solo 02"; "PPPE-062" is in "pppe-062-japanese-jav-movie").
const norm = (s) => ` ${String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `
export const hasPhrase = (text, phrase) => { const p = norm(phrase).trim(); return Boolean(p) && norm(text).includes(` ${p} `) }
export const splitKeywords = (value) => [...new Set(String(value || '').split(/[,\n]/).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean))]
const SMALL = /^(?:a|an|and|in|of|on|the|to|with|for|at|by|or)$/
const titleWords = (s) => s.split(' ').map((w, i) => (/^[a-z]/.test(w) && (i === 0 || !SMALL.test(w)) ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
const sentenceStart = (s) => s.replace(/^[a-z]/, (c) => c.toUpperCase())
// "free lesbian video" -> "lesbian": the phrase without a leading "free" and a trailing video/movie/scene
const focusCore = (focus) => String(focus || '').replace(/^free\s+/i, '').replace(/\s+(?:videos?|movies?|scenes?)$/i, '')
const repeatsWord = (t) => { const seen = new Set(); for (const w of norm(t).trim().split(' ')) { if (w.length < 3) continue; if (seen.has(w)) return true; seen.add(w) } return false }

// The phrase a video should be found by: the performer and the main tag ("Lucy Li big tits"), a JAV film's code, or
// "free <tag> video" when nobody is credited
export function suggestFocus({ cast = [], main = 'Porn', javCode = null, ai = false }) {
  if (javCode) return javCode
  const word = tagWord(main)
  return cast[0] ? `${cast[0]} ${word}` : `free ${ai ? 'AI ' : ''}${word} video`
}

// ---- one video -> one draft row ------------------------------------------------------------------------------------
const JAV_CODE = /^\s*([A-Z]{2,6})[-_ ]?(\d{2,5})\s*$/i
const QUALITY_TAGS = /[[(]\s*(?:4k|2k|uhd|fhd|full ?hd|hd|1080p|720p|1440p|2160p|60 ?fps|vr|remastered)\s*[\])]/gi
export function cleanSourceTitle(t) {
  return decodeEntities(t).replace(QUALITY_TAGS, ' ').replace(/^\s*watch\s+/i, '').replace(/\s+-\s+EPORNER\s*$/i, '').replace(/[[(]\s*[\])]/g, ' ')
    .replace(/\s*~\s*/g, ' – ').replace(/\b([A-Z])([A-Z])([a-z]{2,})\b/g, (_, a, b, rest) => `${a}${b.toLowerCase()}${rest}`) // "CHina" -> "China"
    .replace(/\s{2,}/g, ' ').trim()
}
// An AI-made video: Eporner's "ai" category, or "AI" / "AI-Generated" in its title. It goes to the AI Movie channel.
const AI_TITLE = /^\s*ai\s|\bai[- ]?generated\b/i
// Step and in-law words in Indonesian and Malay, which Eporner uploads often use ("Mertuaku" = my parent-in-law)
const FOREIGN_FAMILY = /\b(?:mertua\w*|menantu\w*|tiri|ipar|iparku)\b/i
const castLabel = (names) => (names.length <= 2 ? names.join(' & ') : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`)
const fits = (text, [lo, hi]) => text.length >= lo && text.length <= hi

// What the three texts are written from. A card's own fields win over the first draft (the person may have changed the
// performers, tags, channel or title); the length, quality and product code come from the source.
function sceneFromTitle(title, cast) {
  let t = String(title || '').replace(/\s*\(\d+\s*Min\)\s*$/i, '').trim()
  const i = t.indexOf(' – ')
  if (i > 0 && cast.some((n) => t.slice(0, i).includes(n))) t = t.slice(i + 3)
  return t.trim()
}
export function basisFromRow(row) {
  const b = row.basis || {}
  const cast = splitKeywords(row.actors)
  const tags = splitKeywords(row.tags)
  const scene = b.javCode || (row.title && row.title !== b.title ? sceneFromTitle(row.title, cast) : b.scene) || sceneFromTitle(row.title, cast)
  return { cast, tags, main: mainTagOf(tags), scene, minutes: Number(row.runtime_minutes) || b.minutes || 1, quality: b.quality || 0, javCode: b.javCode || null, ai: Boolean(b.ai), channel: String(row.channel || b.channel || 'VEXN').trim() }
}

// The search title (30-53), search description (140-160) and page description (200-450). focus: the phrase the
// video should be found by; extras: phrases to work in where they fit. Every candidate that fits the length and is not
// used by another video is scored: the focus phrase first, then each extra, a performer, the scene's name whole.
export function draftTexts(basis, { focus = '', extras = [], taken = {} } = {}) {
  const { cast = [], tags = [], scene, minutes, quality: q = 0, javCode = null, ai = false, channel = 'VEXN' } = basis
  const main = basis.main || mainTagOf(tags)
  const mainWord = tagWord(main)
  const MainWord = tagWord(main, false)
  const topics = tags.filter((t) => t !== main && !['HD', '4K', 'AI Generated'].includes(t) && !(main === 'Jav' && t === 'Japanese'))
  const qShort = q >= 2160 ? '4K ' : q >= 1080 ? 'HD ' : ''
  const qLong = q >= 2160 ? '4K' : q >= 1440 ? `${q}p HD` : q >= 1080 ? '1080p HD' : q ? `${q}p` : ''
  const noun = ai ? 'AI-generated video' : javCode ? 'movie' : 'scene'
  const aMin = `${aOrAn(`${minutes}-minute`)} ${minutes}-minute` // "an 8-minute", "a 21-minute"
  const freeMin = /^free\b/i.test(focus) ? aMin : `a free ${minutes}-minute` // never "free … free"
  const lead = cast[0] || ''
  const pair = cast.length > 1 ? `${cast[0]} & ${cast[1]}` : lead
  const F = focus ? titleWords(focus) : ''
  const extraList = extras.filter((e) => e && !hasPhrase(focus, e))
  // sceneKind: the scene's name whole (+3), cut short (-1) or not used (0); the focus phrase at the very start: +3
  const score = (t, sceneKind = 'none', i = 0) => (focus && hasPhrase(t, focus) ? 100 : 0) + extraList.filter((e) => hasPhrase(t, e)).length * 10
    + (lead && hasPhrase(t, lead) ? 5 : 0) + (focus && norm(t).startsWith(norm(focus).trimEnd()) ? 3 : 0)
    + ({ whole: 3, clipped: -1 }[sceneKind] || 0) - i * 0.01

  // search title
  const patterns = [
    // an AI video says so in its search title, as the AI Movie channel's titles do ("Keg Party – AI-Generated Video")
    ai && `{scene} – AI-Generated ${MainWord} Video`, ai && `{scene} – AI-Generated Video`, ai && `{scene} – Free AI-Generated Video`, ai && `AI-Generated ${MainWord} – {scene}`,
    F && `${F} – {scene}`, F && `{scene} – ${F}`, F && `${F}: {scene}`, F && !/\bfree\b/i.test(F) && `Free ${F} Video – {scene}`, F && `${F} Video – {scene}`,
    F && `${F} – Free ${minutes} Min Video`, F && `${F} Video, ${minutes} Min`,
    ...extraList.map((e) => `{scene} – ${titleWords(e)}`), ...extraList.map((e) => lead && `${lead} – ${titleWords(e)}`),
    ...(javCode && !cast.length
      ? [`${scene} – Free Full-Length Japanese JAV Movie`, `${scene} – Full JAV Movie, ${minutes} Min`, `${scene} – Free Japanese JAV Movie in HD`, `Free JAV Movie ${scene} – ${minutes} Min`]
      : [lead && `${lead} ${MainWord} – {scene}`, pair && `${pair} – {scene}`, pair && `${pair} ${MainWord} – {scene}`, lead && `${lead} – {scene}`,
          lead && `${lead} – {scene}, Free ${MainWord} Video`, lead && `${lead} ${MainWord} Scene – {scene}`, `{scene} – Free ${MainWord} Video`,
          pair && `${pair} ${MainWord} Video, ${minutes} Min`, lead && `Free ${lead} ${MainWord} Video – ${minutes} Min`, `Free ${MainWord} Video – {scene}`]),
  ].filter(Boolean)
  const titleCandidates = []
  patterns.forEach((p, i) => {
    const room = 53 - p.replace('{scene}', '').length
    if (!p.includes('{scene}')) return titleCandidates.push({ t: p, kind: hasPhrase(p, scene) ? 'whole' : 'none', i })
    if (room < 12) return
    titleCandidates.push({ t: p.replace('{scene}', clipWords(scene, room)).replace(/\s{2,}/g, ' ').trim(), kind: scene.length <= room ? 'whole' : 'clipped', i })
  })
  const okTitles = titleCandidates.filter(({ t }) => fits(t, LIMITS.seo_title) && !taken.seo_title?.has(t.toLowerCase()) && !repeatsWord(t))
  const seo_title = okTitles.sort((a, b) => score(b.t, b.kind, b.i) - score(a.t, a.kind, a.i))[0]?.t
    || clipWords(`${pair ? `${pair} – ` : ''}${scene} – ${MainWord} Video`, 53)

  // search description
  const who = cast.length > 2 ? `${listJoin(cast.slice(0, 2))} with ${listJoin(cast.slice(2, 4))}` : listJoin(cast.slice(0, 2))
  const list = (n) => listJoin(topics.slice(0, n).map((t) => tagWord(t)))
  const sceneQ = clipWords(clipWords(scene, 60), 42)
  // focus-led openings: the performers the phrase already names are not named again, nor its tag word, nor "free"
  const focusLeads = focus && !hasPhrase(sceneQ, focus)
  const rest = cast.filter((n) => !hasPhrase(focus, n))
  const restPart = rest.length ? ` with ${listJoin(rest.slice(0, 2))}` : ''
  const mainPart = focus && hasPhrase(focus, mainWord) ? '' : `${mainWord} `
  const watchFocus = /^free\b/i.test(focus) ? `Watch ${focus}` : `Watch ${focus} free`
  const leads = []
  for (const n of [3, 4, 2, 5, 1, 0]) {
    const tagsPart = n && topics.length ? list(n) : ''
    const withTags = tagsPart ? ` with ${tagsPart}` : ''
    const tagged = tagsPart ? ` tagged ${tagsPart}` : ''
    if (focusLeads) {
      leads.push(
        `${watchFocus}: ${sceneQ}${restPart}, ${aMin} ${qShort}${mainPart}${noun}${tagged} on VEXN.`,
        `${sentenceStart(focus)} in ${sceneQ}${restPart}: ${freeMin} ${qShort}${mainPart}${noun}${withTags} on VEXN.`,
        `Free ${focusCore(focus)} video: ${sceneQ}${restPart}, ${minutes} minutes${qShort ? ` in ${qShort.trim()}` : ''}${tagsPart ? `, tagged ${tagsPart}` : ''}, on VEXN.`,
      )
    }
    if (who) {
      leads.push(
        `${who} in ${sceneQ}: a free ${minutes}-minute ${qShort}${mainWord} ${noun}${withTags} on VEXN.`,
        `Watch ${who} in ${sceneQ}, a free ${minutes}-minute ${qShort}${mainWord} ${noun}${tagged}, streaming on VEXN.`,
        `Free ${minutes}-minute ${qShort}${mainWord} ${noun}: ${who} in ${sceneQ}${tagsPart ? `, tagged ${tagsPart}` : ''}. Cast, tags and length on VEXN.`,
      )
    } else if (javCode) {
      leads.push(
        `Watch ${sceneQ} free on VEXN: a full-length ${minutes}-minute Japanese JAV movie${qLong ? ` in ${qLong}` : ''}${tagged}, in the ${channel} channel.`,
        `${sceneQ} is a free, full-length Japanese JAV movie of ${minutes} minutes${qLong ? ` in ${qLong}` : ''}${tagsPart ? `, tagged ${tagsPart}` : ''}. Stream it on VEXN.`,
      )
    } else {
      leads.push(
        `Watch ${sceneQ} free on VEXN: ${aMin} ${qShort}${mainWord} ${noun}${withTags}, listed in the ${channel} channel.`,
        `${sceneQ}: a free ${minutes}-minute ${qShort}${mainWord} ${noun}${tagged}, in the ${channel} channel on VEXN.`,
      )
    }
  }
  const tails = ['', ' Details on VEXN.', ' Length and tags are on the page.', ' It plays in an embedded player.', lead && ` More ${lead} videos on VEXN.`,
    ' Cast, length and tags are listed on the page.', ...extraList.flatMap((e) => [` More ${e} on VEXN.`, ` ${sentenceStart(e)} on VEXN.`, ` Also: ${e}.`])].filter((t, i) => i === 0 || t)
  const descCandidates = tails.flatMap((tail) => leads.map((d, i) => ({ t: tail && /VEXN\.$/.test(d) && /VEXN\.$/.test(tail) && !extraList.some((e) => tail.includes(e)) ? '' : `${d}${tail}`, i }))).filter(({ t }) => t)
  const okDescs = descCandidates.filter(({ t }) => fits(t, LIMITS.seo_description) && !taken.seo_description?.has(t.toLowerCase()))
  const seo_description = okDescs.sort((a, b) => score(b.t, 'none', b.i) - score(a.t, 'none', a.i))[0]?.t
    || [...descCandidates].sort((a, b) => Math.abs(150 - a.t.length) - Math.abs(150 - b.t.length))[0]?.t || ''

  // page description: facts (cast, length, quality, tags, channel, source), then the focus phrase and extras if missing
  const allTopics = listJoin(topics.slice(0, 7).map((t) => tagWord(t)))
  const qualityPart = qLong ? ` in ${qLong}` : ''
  const opening = cast.length
    ? `${listJoin(cast.slice(0, 3))} ${cast.length === 1 ? 'stars' : 'star'} in ${scene}, ${aMin} ${mainWord} ${noun}${qualityPart}.`
    : javCode
      ? `${scene} is a full-length Japanese adult movie (JAV) of ${minutes} minutes${qualityPart}. The source does not credit the cast, so VEXN files it by its studio code.`
      : `${scene} is ${aMin} ${mainWord} ${noun}${qualityPart}.`
  const more = cast.length > 3 ? ` ${listJoin(cast.slice(3))} ${cast.length - 3 === 1 ? 'is' : 'are'} also credited at the source.` : ''
  const tagged = allTopics ? ` It is tagged ${allTopics}.` : ''
  // the closing pointer names the focus phrase when it is about the lead performer ("more Leya Desantis anal videos")
  const pointer = lead && focus && hasPhrase(focus, lead) && !hasPhrase(opening, focus)
    ? `more ${focusCore(focus)} videos are listed on VEXN`
    : cast.length ? `the ${cast[0]} page lists more videos on VEXN` : `the ${channel === 'VEXN' ? `${tagWord(main, false)} category` : `${channel} page`} lists more videos like it`
  let description = `${opening}${more}${tagged} It sits in the ${channel} channel and plays in an embedded player from Eporner; ${pointer}.`
  if (description.length > 450) description = `${opening}${tagged} It plays in an embedded player from Eporner; ${pointer}.`
  if (focus && !hasPhrase(description, focus)) {
    const add = /\b(?:videos?|movies?|scenes?)$/i.test(focus) ? ` Find another ${focus} on VEXN.` : ` More ${focus} videos are on VEXN.`
    if (description.length + add.length <= 450) description += add
  }
  const missing = extraList.filter((e) => !hasPhrase(description, e))
  if (missing.length) {
    for (let n = missing.length; n > 0; n--) {
      const add = ` Related searches: ${listJoin(missing.slice(0, n))}.`
      if (description.length + add.length <= 450) { description += add; break }
    }
  }
  if (description.length < 200) description += ' Cast, tags and length are listed above the player.'
  return { seo_title, seo_description, description }
}

// The address: the focus phrase first, then the scene ("leya-desantis-anal-vaginal-sex-is-prohibited"); a JAV film
// is "<code>-japanese-jav-movie". Unique against the site and the removed addresses.
// A generic phrase ("free MILF video") does not lead the address: a video without a credited performer is named by its
// scene and main tag ("am-i-giving-you-a-hard-on-milf"), an AI video ends in "-ai-generated" like the AI Movie channel's.
export function slugFor({ cast = [], scene = '', javCode = null, ai = false, focus = '', main = '', code = '', minutes = 0 }, taken = {}) {
  let base
  if (javCode) base = slugify(`${scene} japanese jav movie`)
  else if (!focus || /^free\b/i.test(focus)) base = slugify(`${cast.slice(0, 2).join(' ')} ${clipWords(scene, 60)} ${ai ? 'ai generated' : main}`)
  else {
    const head = slugify(focus)
    let tail = slugify(clipWords(scene, 60)).split('-')
    const last = head.split('-').at(-1)
    while (tail.length && tail[0] === last) tail = tail.slice(1) // "lucy-li-pov" + "pov-i-deserve-this"
    base = [head, tail.join('-'), ai ? 'ai-generated' : ''].filter(Boolean).join('-')
  }
  base = base.slice(0, 90).replace(/-[^-]*$/, (m) => (base.length > 90 && m.length > 1 ? '' : m)).replace(/^-+|-+$/g, '') || `video-${String(code).toLowerCase()}`
  for (const extra of ['', `-${minutes}-min`, `-${String(code).toLowerCase()}`]) {
    const s = `${base}${extra}`
    if (!taken.slug?.has(s)) return s
  }
  return base
}

// keywords: the cast, the product code, the focus phrase, the tags (not HD/4K) and the extras, each once
export function keywordsFor({ cast = [], tags = [], javCode = null }, { focus = '', extras = [] } = {}) {
  const words = [...cast, ...(javCode ? [javCode] : []), ...(focus && focus !== javCode ? [focus] : []), ...tags.filter((t) => !['HD', '4K'].includes(t)), ...extras]
  const out = []
  for (const w of words) if (w && !out.some((o) => o.toLowerCase() === w.toLowerCase())) out.push(w)
  return out.join(', ')
}

// site: { channels: Map(slug -> name), freeAllowed: Map(slug -> name), taken: { slug, title, seo_title, seo_description: Set(lower-case) } }
// video: { code, api (Eporner API object), watch (parseWatchPage) }; extras: phrases to work into every draft
export function draftRow({ code, api = {}, watch = {} }, site, { extras = [] } = {}) {
  const minutes = Math.max(1, Math.round((api.length_sec || toSec(watch.duration || '0')) / 60))
  const rawTitle = cleanSourceTitle(api.title || watch.title || '')
  const keywords = String(api.keywords || '')
  const categories = watch.categories || []
  const javMatch = rawTitle.match(JAV_CODE)
  const jav = Boolean(javMatch) || categories.includes('japanese') || /\b(?:jav|japanese)\b/i.test(`${rawTitle} ${keywords}`)
  const blowjob = mentionsBlowjob(`${rawTitle} ${keywords} ${categories.join(' ')}`)
  const teenSource = categories.find((c) => TEEN_SOURCE.has(c)) || (TEEN_WORDS.test(`${rawTitle} ${keywords}`) ? `${rawTitle} ${keywords}`.match(TEEN_WORDS)[0] : null)
  // the importers' stricter guard: family, school and age themes, out-of-scope content, compilations (by the source's own words)
  const sourceText = `${rawTitle} ${keywords} ${categories.join(' ')}`
  const guard = (sourceText.match(EXTRA_BLOCK) || sourceText.match(OFF_SCOPE) || rawTitle.match(COMPILATION) || [])[0] || null
  // the site's block rules applied to what Eporner says about the video (its categories and tags, e.g. "stepmom"), not
  // only to the text written here; youth wording in a category is the Teens case above (owner: neutral wording)
  const sourceHits = checkContent({ title: rawTitle, tags: [...categories, ...(watch.tags || [])].join(' '), keywords })
  const sourceBlock = sourceHits.block.find((h) => h.id !== 'youth-school')?.match || (sourceText.match(FOREIGN_FAMILY) || [])[0] || null
  const ai = categories.includes('ai') || AI_TITLE.test(rawTitle)

  // cast: women first (the names people search for), as Eporner credits them
  const credited = [...(watch.cast || [])].sort((a, b) => (a.gender === 'Female' ? 0 : 1) - (b.gender === 'Female' ? 0 : 1)).map((c) => c.name)
  const cast = cleanCast(credited, { name: '~' })

  // channel: a studio channel the site already has, else AI Movie for AI videos, JAV Movies for Japanese films, else VEXN
  const studio = watch.channel ? site.channels.get(slugify(watch.channel.name)) || site.channels.get(watch.channel.slug) || null : null
  const aiChannel = site.channels.get('ai-movie') || null
  const channel = studio || (ai && aiChannel ? aiChannel : jav && javMatch ? 'JAV Movies' : 'VEXN')

  const tags = videoTags({ categories, keywords, jav, ai, blowjob, maxQuality: watch.maxQuality || 0, castCount: cast.length }, site.freeAllowed)
  const main = mainTagOf(tags)

  // the scene's own name; a product code stays as written ("PPPE-062"), a missing one becomes "<Tag> Scene";
  // an AI video's "AI" / "AI-Generated" goes, the title says it once at the end
  const javCode = javMatch ? `${javMatch[1].toUpperCase()}-${javMatch[2]}` : null
  let scene = javCode || sceneTitle(dropReversedNames(rawTitle, cast), cast, { name: studio || '~' })
  if (ai) scene = scene.replace(/\s*[–~-]?\s*\(?\bai[- ]?generated\b\)?\s*$/i, '').replace(/^\s*ai\s+/i, '')
  scene = scene.replace(TEEN_WORDS, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s–-]+|[\s–-]+$/g, '').trim()
  if (scene.replace(/[^A-Za-z0-9]/g, '').length < 4) scene = `${tagWord(main, false)} Scene`

  // title shown on the page
  const aiPart = ai ? ' – AI Generated' : ''
  const title = javCode && !cast.length
    ? `${scene} – Japanese JAV Movie (${minutes} Min)`
    : cast.length ? `${castLabel(cast.slice(0, 3))} – ${clipWords(scene, 70)}${aiPart} (${minutes} Min)` : `${clipWords(scene, 80)}${aiPart} (${minutes} Min)`

  const taken = site.taken || {}
  const q = watch.maxQuality || 0
  const basis = { cast, tags, main, scene, minutes, quality: q, javCode, ai, channel, title }
  const focus = suggestFocus(basis)
  const slug = slugFor({ ...basis, focus, code }, taken)
  const texts = draftTexts(basis, { focus, extras, taken })
  const poster = posterFrom(api.default_thumb?.src)
  return {
    include: true,
    code,
    source_url: `${ORIGIN}/video-${code}/`,
    source_title: decodeEntities(api.title || watch.title || ''),
    source_cast: credited,
    source_categories: categories,
    title,
    slug,
    poster_url: poster.large || poster.small || null,
    poster_small: poster.small || null,
    trailer_url: api.embed || `${ORIGIN}/embed/${code}/`,
    slug_auto: slug,
    focus,
    focus_used: focus,
    extras_used: extras,
    ...texts,
    keywords: keywordsFor(basis, { focus, extras }),
    tags: tags.join(', '),
    actors: cast.length ? cast.join(', ') : '',
    channel,
    runtime_minutes: minutes,
    source_published_at: api.added || null,
    basis,
    flags: { blowjob, teenSource, guard, sourceBlock, ai, jav, studio, quality: q },
  }
}

// Write the three texts and the keywords again from a card's current fields, with its focus phrase and the extras
// (the keywords keep what the person typed, minus the focus phrase and extras of the previous draft)
export function redraftRow(row, { extras = [], taken = {} } = {}) {
  const basis = basisFromRow(row)
  const focus = String(row.focus || '').trim() || suggestFocus(basis)
  const texts = draftTexts(basis, { focus, extras, taken })
  const previous = new Set([row.focus_used, ...(row.extras_used || [])].filter(Boolean).map((k) => k.toLowerCase()))
  const kept = splitKeywords(row.keywords).filter((k) => !previous.has(k.toLowerCase()) && !basis.cast.includes(k))
  const keywords = keywordsFor(basis, { focus, extras: [...kept, ...extras] })
  // the address follows the new focus phrase unless the person typed their own
  const ownSlug = row.slug && row.slug !== row.slug_auto
  const slug = ownSlug ? row.slug : slugFor({ ...basis, focus, code: row.code }, taken)
  return { focus, ...texts, keywords, slug, slug_auto: ownSlug ? row.slug_auto : slug, focus_used: focus, extras_used: extras }
}

// ---- SEO checklist ------------------------------------------------------------------------------------------------
// What a card does for search, item by item: the focus phrase in each text, the lengths, a performer and "free"/"watch",
// uniqueness on the site, and each extra keyword (where it appears). -> { items: [{ label, ok, detail? }], done, total }
export function seoChecklist(row, { extras = [], site = {} } = {}) {
  const items = []
  const add = (label, ok, detail = '') => items.push({ label, ok: Boolean(ok), detail })
  const t = (k) => String(row[k] ?? '').trim()
  const focus = t('focus')
  const where = (phrase) => [['search title', 'seo_title'], ['search description', 'seo_description'], ['page description', 'description'], ['address', 'slug']]
    .filter(([, k]) => (k === 'slug' ? t('slug').includes(slugify(phrase)) : hasPhrase(t(k), phrase))).map(([name]) => name)
  if (!focus) add('Focus keyword set', false, 'type the phrase this video should be found by')
  else {
    add('Focus keyword in the search title', hasPhrase(t('seo_title'), focus))
    add('Focus keyword at the start of the search title', norm(t('seo_title')).startsWith(norm(focus).trimEnd()))
    add('Focus keyword in the search description', hasPhrase(t('seo_description'), focus))
    add('Focus keyword in the page description', hasPhrase(t('description'), focus))
    add('Focus keyword in the address', slugify(focusCore(focus)) && t('slug').includes(slugify(focusCore(focus))), `/movie/${t('slug')}`)
    add('Focus keyword in the keywords', splitKeywords(t('keywords')).some((k) => k.toLowerCase() === focus.toLowerCase()) || hasPhrase(t('keywords'), focus))
  }
  const cast = splitKeywords(t('actors'))
  if (cast.length) add('A performer in the search title', cast.some((n) => hasPhrase(t('seo_title'), n)))
  add('“free” or “watch” in the search description', /\b(?:free|watch)\b/i.test(t('seo_description')))
  for (const [k, label] of [['seo_title', 'Search title'], ['seo_description', 'Search description'], ['description', 'Page description']]) {
    const [lo, hi] = LIMITS[k]
    add(`${label} ${lo}–${hi} characters`, fits(t(k), LIMITS[k]), `${t(k).length}`)
  }
  const taken = site.taken || {}
  const reused = ['title', 'seo_title', 'seo_description'].filter((k) => taken[k]?.has(t(k).toLowerCase()))
  add('Title and search texts not used by another video', !reused.length, reused.length ? reused.map((k) => k.replace('_', ' ')).join(', ') : '')
  for (const e of extras.filter(Boolean)) {
    const found = where(e)
    add(`“${e}”`, found.some((w) => w !== 'address'), found.length ? `in the ${listJoin(found)}` : 'not in the texts')
  }
  return { items, done: items.filter((i) => i.ok).length, total: items.length }
}

// ---- checks -------------------------------------------------------------------------------------------------------
// Three levels:
//   errors    can never go into the SQL: the site's block rules (youth/school and teen wording, non-consent, forced,
//             leaked or hidden camera, step-family/incest, virgin, hypnosis) and faults that would make a broken or
//             skipped row (no title, a bad or used address, no player, no length, no channel, already on the site,
//             twice in the list)
//   fixes     should be fixed, but a person who ticks the card adds it as it is: lengths, wording another video uses,
//             no working poster, the site's review words (family words, teacher, sleeping), the importers' stricter
//             guard (family, daddy, nanny, innocent, tutor, nerd), out-of-scope content, compilations
//   warnings  for information only
// site: as for draftRow, plus codes: Set of Eporner codes already on the site and removed: Set of removed addresses.
// others: the other rows of this batch (for duplicates inside the batch).
const GUARD_YOUTH = /\b(?:cheerlead\w*|high ?school\w*|school\w*|campus|dorm|freshman|sophomore|just turned|young(?:er)?|jailbait|prom|homework|classmate|babysit\w*)\b/i
const GUARD_SOFT = /\b(?:famil(?:y|ies)|daddy|nanny|innocent|tutor|nerd)\b/i
export function checkRow(row, site, others = [], { minMinutes = MIN_MINUTES, skipBlowjob = true } = {}) {
  const errors = []
  const fixes = []
  const warnings = []
  const text = (k) => String(row[k] ?? '').trim()
  if (site.codes?.has(row.code)) errors.push('already on the site')
  if (!text('title')) errors.push('title is empty')
  if (text('title').length > 120) fixes.push(`title is ${text('title').length} characters (120 at most)`)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text('slug'))) errors.push('address: lower-case letters, digits and single hyphens only')
  else if (text('slug').length > 110) errors.push('address is longer than 110 characters')
  for (const [k, [lo, hi]] of Object.entries(LIMITS)) {
    const n = text(k).length
    if (n < lo || n > hi) fixes.push(`${k.replace('_', ' ')} is ${n} characters (${lo}-${hi})`)
  }
  if (!text('poster_url')) fixes.push('no working poster (the card on the site will have no picture)')
  if (!text('trailer_url')) errors.push('no player address')
  if (!(Number(row.runtime_minutes) > 0)) errors.push('length is missing')
  if (!text('tags')) warnings.push('no tags')
  if (!text('channel')) errors.push('channel is empty')
  const taken = site.taken || {}
  const lower = (k) => text(k).toLowerCase()
  if (taken.slug?.has(lower('slug')) || site.removed?.has(lower('slug'))) errors.push('address is used (or was removed) on the site: change the address')
  if (taken.title?.has(lower('title'))) fixes.push('another video has this title')
  if (taken.seo_title?.has(lower('seo_title'))) fixes.push('another video has this search title')
  if (taken.seo_description?.has(lower('seo_description'))) fixes.push('another video has this search description')
  const twin = (k) => others.some((o) => o !== row && o.include && String(o[k] || '').trim().toLowerCase() === lower(k))
  if (twin('slug')) errors.push('same address as another ticked video in this list')
  for (const k of ['title', 'seo_title', 'seo_description']) if (twin(k)) fixes.push(`same ${k.replace('_', ' ')} as another video in this list`)
  if (others.some((o) => o !== row && o.include && o.code === row.code)) errors.push('this video is in the list twice')
  const all = ['title', 'slug', 'tags', 'keywords', 'actors', 'description', 'seo_title', 'seo_description'].map(text).join(' ')
  const teen = all.match(TEEN_WORDS)
  if (teen) errors.push(`teen-type word "${teen[0]}": use neutral wording`)
  const youth = all.match(GUARD_YOUTH)
  if (youth && !(teen && youth[0].toLowerCase() === teen[0].toLowerCase())) errors.push(`school or age word "${youth[0]}": use neutral wording`)
  const soft = all.match(GUARD_SOFT) || all.match(OFF_SCOPE)
  if (soft) fixes.push(`site rule: "${soft[0]}" (family theme or out of scope)`)
  if (COMPILATION.test(text('title'))) fixes.push(`site rule: "${text('title').match(COMPILATION)[0]}" (compilations are usually left out)`)
  const hits = checkContent({ title: text('title'), slug: text('slug'), tags: text('tags'), keywords: text('keywords'), description: `${text('description')} ${text('seo_description')} ${text('seo_title')}` })
  for (const h of hits.block) if (!errors.some((e) => e.includes(`"${h.match}"`))) errors.push(`content rule: ${h.label} ("${h.match}")`)
  for (const h of hits.review) fixes.push(`content rule to review: ${h.label} ("${h.match}")`)
  const foreign = all.match(FOREIGN_FAMILY)
  if (foreign) errors.push(`content rule: step-family / in-law ("${foreign[0]}")`)
  const f = row.flags || {}
  // what Eporner says about the video counts too: rewording the title does not change a step-family scene
  if (f.sourceBlock) errors.push(`Eporner files it under "${f.sourceBlock}": the site does not add step-family, in-law, forced, non-consent or hidden-camera videos`)
  if (f.blowjob) warnings.push(skipBlowjob ? 'blowjob video: held by your rule; tick Add to include it' : 'blowjob video')
  if (f.teenSource) warnings.push(`Eporner files it under "${f.teenSource}": the text avoids teen wording`)
  if (f.guard && !soft && !youth) warnings.push(`the source says "${f.guard}": the site usually keeps family, school and age themes, out-of-scope videos and compilations out; check the video before adding it`)
  if (Number(row.runtime_minutes) < minMinutes) warnings.push(`under ${minMinutes} minutes`)
  if (Number(row.runtime_minutes) > MAX_MINUTES) warnings.push(`over ${MAX_MINUTES} minutes`)
  if (!text('actors')) warnings.push('no performer credited')
  return { errors, fixes, warnings }
}

// Ticked by default: nothing to fix, not held by the blowjob rule, no guard word in the source, long enough
// The tool drafts, it does not decide (owner, 14 Nov 2026: "allow all selected", the SQL gets a second check by Claude
// before it is applied). So every drafted video is ticked unless the person asks for "only ready videos", and every
// ticked one goes into the SQL; what checkRow finds is written above the row as a "-- CHECK" comment.
export const defaultInclude = (row, check, { minMinutes = MIN_MINUTES, skipBlowjob = true, tickAll = true } = {}) =>
  tickAll || (!check.errors.length && !(check.fixes || []).length && !(skipBlowjob && row.flags?.blowjob) && !row.flags?.guard && Number(row.runtime_minutes) >= minMinutes)
// No site rule and nothing to fix: what "only ready videos" ticks
export const canAdd = (check) => !check.errors.length

// Faults that would make a broken or silently skipped row are mended before the SQL is written, so a ticked video always
// goes in: an empty or invalid address (rebuilt from the title), an address the site or this list already uses (the
// Eporner code is added), an empty title (the source's), an empty channel (VEXN). -> { row, changes: [] }
export function mendRow(row, site, usedInBatch = new Set()) {
  const changes = []
  const r = { ...row }
  const code = String(r.code || '').toLowerCase()
  if (!String(r.title || '').trim()) { r.title = r.source_title || `Video ${r.code}`; changes.push('title was empty: the source title is used') }
  let slug = String(r.slug || '').trim()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 110) {
    slug = slugify(slug || r.title).slice(0, 100).replace(/-+$/, '') || `video-${code}`
    changes.push(`address rebuilt as ${slug}`)
  }
  if (site.taken?.slug?.has(slug) || site.removed?.has(slug) || usedInBatch.has(slug)) {
    slug = `${slug}-${code}`.slice(0, 110)
    changes.push(`address was in use: changed to ${slug}`)
  }
  r.slug = slug
  usedInBatch.add(slug)
  if (!String(r.channel || '').trim()) { r.channel = 'VEXN'; changes.push('channel was empty: VEXN') }
  return { row: r, changes }
}

// ---- SQL ----------------------------------------------------------------------------------------------------------
const COLUMNS = ['title', 'slug', 'poster_url', 'trailer_url', 'description', 'keywords', 'tags', 'actors', 'channel', 'runtime_minutes', 'seo_title', 'seo_description', 'featured', 'created_at', 'source', 'source_published_at']
function quote(value) {
  if (value == null || value === '') return 'null'
  const s = String(value)
  let tag = 'q'
  while (s.includes(`$${tag}$`)) tag += 'q'
  return `$${tag}$${s}$${tag}$`
}
// One insert for the whole batch; the first row is the newest on the site. Re-running it adds nothing twice.
// A row's `notes` (what the checks found) are written above it as "-- CHECK" lines for the second check.
const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
export function rowsToSql(rows, { note = '' } = {}) {
  const values = rows.map((r, i) => {
    const check = (r.notes || []).length ? `  -- CHECK ${oneLine(r.title)} [${r.code || ''}]: ${oneLine(r.notes.join('; '))}\n` : ''
    return `${check}  (${[
      quote(r.title), quote(r.slug), quote(r.poster_url), quote(r.trailer_url), quote(r.description), quote(r.keywords), quote(r.tags),
      quote(r.actors), quote(r.channel), Number(r.runtime_minutes) || 'null', quote(r.seo_title), quote(r.seo_description), 'false',
      `now() - interval '${i} seconds'`, quote('Eporner'), r.source_published_at ? `${quote(r.source_published_at)}::timestamptz` : 'null',
    ].join(', ')})`
  })
  const flagged = rows.filter((r) => (r.notes || []).length).length
  const head = [
    `-- VEXN link tool${note ? `: ${oneLine(note)}` : ''}`,
    `-- ${rows.length} video${rows.length === 1 ? '' : 's'}${flagged ? `; ${flagged} marked CHECK below need the second check before this is run` : ''}.`,
    '-- Run in the Supabase SQL editor; a video whose address is already used is skipped.',
  ].join('\n')
  return `${head}\ninsert into public.movies (${COLUMNS.join(', ')})\nvalues\n${values.join(',\n')}\non conflict (slug) do nothing\nreturning slug;\n`
}
