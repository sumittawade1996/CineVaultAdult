// Pure logic for importing studio videos from Eporner (scripts/import-eporner-studios.mjs): which videos
// qualify, how the title, tags and search texts are built. No network here, so it can be tested.
//
// Rules the owner set (19 Oct 2026): studios Brazzers, Vixen, Bangbros and Adult Time; videos of 20 minutes or
// more; newest first; no blowjob videos; search titles and descriptions built from the site's own formula
// with the keywords visitors actually search. On top of src/lib/contentRules.js this importer applies a
// stricter guard (school and age words, trans and gay content, compilations) because nobody reviews the rows.
import { CONTROLLED_BY_SLUG, LABEL_TAGS, normalizeTags } from '../../src/lib/categories.js'
import { slugify } from '../../src/lib/slugify.js'
import { checkContent } from '../../src/lib/contentRules.js'
import { aOrAn, listJoin } from './movieCopy.mjs'

export const STUDIOS = {
  // Brazzers' own sites (Real Wife Stories, Big Tits At Work, ...) count as Brazzers: their uploads often leave the network name out of the title
  brazzers: {
    name: 'Brazzers',
    brand: /\bbrazzers\b|\bzz ?series\b|\breal wife stories\b|\bbig tits at work\b|\bbig wet butts\b|\bpornstars like it big\b|\bmilfs like it big\b|\bdoctor adventures\b|\bhot and mean\b|\bday with a pornstar\b/i,
    queries: ['brazzers', 'brazzers exxtra', 'real wife stories', 'big tits at work', 'big wet butts', 'pornstars like it big', 'milfs like it big', 'doctor adventures', 'hot and mean', 'day with a pornstar', 'brazzers milf', 'brazzers big tits', 'brazzers anal', 'brazzers threesome', 'brazzers lesbian', 'brazzers massage'],
    channels: [],
  },
  vixen: { name: 'Vixen', brand: /^\s*vixen\s*(?:[-–—:|]|\d{2}[ ._-]\d{2})|\bvixen\.com\b/i, queries: ['vixen', 'vixen threesome', 'vixen lesbian', 'vixen big tits', 'vixen anal', 'vixen massage', 'vixen blonde', 'vixen brunette', 'vixen 2026', 'vixen 2025'], channels: ['vixen'] }, // the word is also used as a noun, so only the official channel and titles that start with it count
  bangbros: { name: 'Bangbros', brand: /\bbang\s?bros\b|\bbangbros\b|\bass parade\b|\bbang ?bus\b/i, queries: ['bangbros', 'ass parade', 'bang bus'], channels: [] }, // Ass Parade and Bang Bus are Bangbros sites
  'adult-time': { name: 'Adult Time', brand: /\badult\s?time\b|\badulttime\b/i, queries: ['adult time'], channels: [] },
}

// What first-party traffic says visitors look for (VEXN page_views and the search box, 11 Sep - 19 Oct 2026:
// category pages opened, plus search terms mapped to categories). Used only to order the keywords in the texts.
export const TREND = {
  indian: 121, 'big-tits': 100, milf: 85, threesome: 25, bhabhi: 25, desi: 20, 'big-ass': 19, blonde: 19, hardcore: 18,
  anal: 17, massage: 17, homemade: 17, public: 17, brunette: 17, lesbian: 16, amateur: 14, pov: 13, housewives: 12,
  outdoor: 12, redhead: 12, petite: 10, romantic: 10, creampie: 10, cuckold: 10, hotel: 9, cumshot: 8, bbw: 8,
  mature: 7, asian: 7, interracial: 6, 'group-sex': 6, squirt: 6, toys: 5, pawg: 5,
}

// Eporner keyword -> the site's tag, for the common spellings that differ
const SYNONYMS = new Map(Object.entries({
  'big tits': 'Big Tits', 'natural tits': 'Big Tits', 'big natural tits': 'Big Tits', 'huge tits': 'Big Tits', busty: 'Big Tits', 'big boobs': 'Big Tits',
  'big ass': 'Big Ass', 'big butt': 'Big Ass', 'round ass': 'Big Ass', pawg: 'PAWG', milf: 'MILF', 'p.o.v.': 'POV', pov: 'POV',
  orgy: 'Group Sex', 'group sex': 'Group Sex', 'double penetration': 'Double Penetration', dp: 'Double Penetration',
  'big dick': 'Big Dick', 'big cock': 'Big Dick', 'monster cock': 'Big Dick', 'small tits': 'Small Tits', 'tiny tits': 'Small Tits',
  'oil massage': 'Massage', 'sensual massage': 'Massage', 'hard core': 'Hardcore', 'hardcore': 'Hardcore',
}))

// The act itself, not only the tag: a title such as "Blonde Sucks & Fucks" counts as a blowjob video
const BLOWJOB = /blow\s?jobs?|blow ?bang\w*|\bbj\b|\bblowie\b|\bsuck(?:s|ed|ing)?\b|cock ?suck\w*|deep ?throat\w*|face ?fuck\w*|\bswallow\w*|\boral\b|\bgives head\b|\bhead(?:job)?\b(?= (?:and|&)|\s*$)/i
// Words that contradict a studio production: an upload that carries them and only mentions the studio is not the studio's own
// ("amateur" alone is not on the list: Eporner users add it to almost everything, studio scenes included)
// (regional amateur uploads that borrow a studio's name for search traffic are on it too)
const NOT_A_STUDIO = /\b(?:homemade|webcam|onlyfans|selfie|self ?shot|hidden ?cam\w*|spy ?cam\w*|leaked|vlog|reddit|tiktok|snapchat|sri ?lankan|desi|indian|bhabhi|tamil|telugu|hindi|mallu|aunty|pakistani|bangladeshi|hijab)\b/i
// Another studio named in the title: the upload is a mix-up or a re-upload under the wrong name
const OTHER_STUDIO = /\b(?:naughty ?america|reality ?kings|mofos|blacked(?:raw)?|tushy(?:raw)?|digital ?playground|team ?skeet|evil ?angel|girlsway|girlfriends ?films|pure ?taboo|nubiles|met-?art|x-?art|21 ?sextury|jules ?jordan|fakehub|public ?agent|burning ?angel|hardx|lethal ?hardcore|pornpros|passion-?hd|sweet ?sinner|dogfart|new ?sensations|spizoo|exploited ?college|casting ?couch|net ?video ?girls)\b/i
const EXTRA_BLOCK = /\b(?:famil(?:y|ies)|cheerlead\w*|high ?school\w*|school\w*|campus|dorm|freshman|sophomore|babysit\w*|nanny|innocent|just turned|young(?:er)?|jailbait|daddy|prom|homework|classmate|tutor|nerd)\b/i
const OFF_SCOPE = /\b(?:gay|trans(?:gender|sexual)?|shemale|tranny|ladyboy|crossdress\w*|femboy|sissy)\b/i
const COMPILATION = /\b(?:compilation|cumpilation\w*|best of|collection|top \d+|megamix|pmv|montage|highlights|marathon)\b/i

export const mentionsBlowjob = (text) => BLOWJOB.test(String(text || ''))

// Why a video does not qualify, or null when it does. v: { title, keywords, length_sec }
// allowKeywordBrand: an upload that names the studio only in its keywords may pass (the importer then
// requires a credited performer and marks the row); allowBlowjob: only for preparing a held set, never applied unasked
export function excludeReason(v, studio, { minMinutes = 20, maxMinutes = 90, verifiedChannel = false, allowKeywordBrand = false, allowBlowjob = false } = {}) {
  const text = `${v.title || ''} ${v.keywords || ''}`
  const minutes = (v.length_sec || 0) / 60
  if (minutes < minMinutes) return `under ${minMinutes} minutes`
  if (minutes > maxMinutes) return `over ${maxMinutes} minutes (not a single scene)`
  // a title that is garbled (broken characters) or not in the Latin alphabet cannot be shown or searched
  const letters = (v.title || '').replace(/[^\p{L}]/gu, '')
  if (letters.length < 3 || letters.replace(/[^A-Za-z]/g, '').length / letters.length < 0.8 || /Ã|â€/.test(v.title || '')) return 'unreadable title'
  if (/\bsc\d+\b/i.test(v.title || '') || /(?:\w+\.){3,}\w/.test(v.title || '')) return 'file-name style title' // "Sc7", ".17.02.08.name.XXX"
  // another studio, or one of the other three importer studios, named in the title
  const own = Object.values(STUDIOS).filter((s) => s.name !== studio.name)
  if (OTHER_STUDIO.test(v.title || '') || own.some((s) => s.brand.test(v.title || ''))) return 'names another studio'
  if (!verifiedChannel && !studio.brand.test(text)) return 'studio not named'
  // an upload (not the studio's own channel) must name the studio in its TITLE and must not look like amateur content
  if (!verifiedChannel && !allowKeywordBrand && !studio.brand.test(v.title || '')) return 'studio only in keywords'
  if (!verifiedChannel && NOT_A_STUDIO.test(text)) return 'looks like an amateur upload'
  if (!allowBlowjob && BLOWJOB.test(text)) return 'blowjob'
  const hits = checkContent({ title: v.title, tags: v.keywords, keywords: v.keywords })
  if (hits.block.length) return `content rule: ${hits.block.map((h) => h.match).join(', ')}`
  if (hits.review.length) return `needs review: ${hits.review.map((h) => h.match).join(', ')}`
  if (EXTRA_BLOCK.test(text)) return `guard: ${text.match(EXTRA_BLOCK)[0]}`
  if (OFF_SCOPE.test(text)) return `out of scope: ${text.match(OFF_SCOPE)[0]}`
  if (COMPILATION.test(v.title || '')) return 'compilation'
  return null
}

// ---- tags ------------------------------------------------------------------------------------
// keywords: Eporner's comma list. freeAllowed: Map(slug -> name) of free tags already used on the site.
export function mapTags(keywords, studio, freeAllowed = new Map(), max = 6) {
  const out = []
  const seen = new Set()
  for (const raw of String(keywords || '').split(',')) {
    const k = raw.trim()
    if (!k) continue
    const slug = slugify(k)
    let name = SYNONYMS.get(k.toLowerCase())
    if (!name && CONTROLLED_BY_SLUG.has(slug)) name = CONTROLLED_BY_SLUG.get(slug)
    if (!name && freeAllowed.has(slug) && !LABEL_TAGS.has(slug)) name = freeAllowed.get(slug)
    if (!name || BLOWJOB.test(name)) continue
    const s = slugify(name)
    if (seen.has(s) || s === 'amateur' || s === 'homemade') continue // a studio's scene is neither: Eporner users add these tags to almost everything
    seen.add(s)
    out.push(name)
  }
  // most searched first (our own traffic), then the order Eporner gave
  const ranked = out.map((name, i) => ({ name, i, w: TREND[slugify(name)] || 0 })).sort((a, b) => b.w - a.w || a.i - b.i).slice(0, max).map((x) => x.name)
  return normalizeTags([studio.name, ...ranked].join(', ')).tags
}

// ---- title -----------------------------------------------------------------------------------
const ucRatio = (s) => { const l = s.replace(/[^A-Za-z]/g, ''); return l ? l.replace(/[^A-Z]/g, '').length / l.length : 0 }
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(&"-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// release-date file names ("Vixen 26 07 31 angela white 9eb6"): the date, the performers and a short code
const DATED = /^\s*\d{2}[ ._-]\d{2}[ ._-]\d{2}\s+/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const studioRe = (studio) => new RegExp(`\\b${studio.name.split(' ').map(escapeRe).join('\\s?')}(?:\\s+network)?\\b`, 'ig') // "Adult Time" also as "AdultTime"; "Bangbros Network"

// The body of a file-name style title without its date and trailing code, or null when the title is not of that kind
function stripDated(text) {
  if (!DATED.test(text)) return null
  const tokens = text.replace(DATED, '').trim().split(/\s+/)
  const last = tokens[tokens.length - 1] || ''
  const prev = tokens[tokens.length - 2] || ''
  // the code is four characters: with a digit in it, or a capitalised one after lower-case names
  if (tokens.length >= 3 && /^[a-z0-9]{4}$/i.test(last) && (/\d/.test(last) || (/^[A-Z]/.test(last) && /^[a-z]/.test(prev)))) tokens.pop()
  return tokens.join(' ')
}

// Performers named in a file-name style title ("Vixen 26 09 04 kendra sunderland and alina lopez 9awd"), or []
export function castFromTitle(rawTitle, studio) {
  let t = String(rawTitle || '')
  if (studio) t = t.replace(studioRe(studio), ' ')
  const body = stripDated(t)
  if (!body || !/^[a-z' ,&]+$/i.test(body)) return []
  const names = body.split(/\s+(?:and|&)\s+|\s*,\s*/i).map((n) => n.trim()).filter(Boolean)
  if (!names.length || names.length > 3 || names.some((n) => n.split(/\s+/).length < 2 || n.split(/\s+/).length > 3)) return []
  return names.map(titleCase)
}

// Eporner's performer list also holds aliases, tag words and the studio's own name; keep one entry per person
const NOT_A_NAME = /\b(?:milf|mom|mommy|babe|teen|mature|granny|pornstar|porn|amateur|lesbian|couple|sex|anal|xxx)\b/i
const lev = (a, b) => {
  const row = [...Array(b.length + 1).keys()]
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}
function sameWho(a, b) {
  const [fa, ...ra] = a.toLowerCase().split(' ')
  const [fb, ...rb] = b.toLowerCase().split(' ')
  if (fa === fb && ra.length && rb.length) {
    const x = ra.join(' ')
    const y = rb.join(' ')
    if (x.startsWith(y) || y.startsWith(x) || x.length === 1 || y.length === 1) return true // "Anna Claire" / "Anna Claire Clouds", "Angela B" / "Angela White"
  }
  return lev(a.toLowerCase(), b.toLowerCase()) <= 1 // "Lindsey Meadows" / "Lindsay Meadows"
}
export function cleanCast(cast = [], studio) {
  const brandWords = new Set(studio.name.toLowerCase().split(' '))
  const names = []
  for (const raw of cast) {
    const n = String(raw || '').trim().replace(/\s+/g, ' ')
    if (!n || n.toLowerCase().split(' ').some((w) => brandWords.has(w)) || NOT_A_NAME.test(n)) continue // "Juliana Bangbros", "Angela Milf"
    const i = names.findIndex((k) => sameWho(k, n))
    if (i >= 0) { if (n.length > names[i].length) names[i] = n; continue }
    names.push(n)
  }
  return names.slice(0, 6)
}

// The scene's own title: the studio name, the performers' names and separators removed
export function sceneTitle(rawTitle, cast = [], studio) {
  let t = String(rawTitle || '').replace(/\p{Extended_Pictographic}/gu, '')
  t = t.replace(/\s{2,}/g, ' | ')                                   // "A   B   C" separators
  t = t.replace(studioRe(studio), ' ')
  t = t.replace(/\bexxtra\b/gi, ' ') // a series name inside the studio's, not part of the scene's title
  let sceneDate = ''
  const dated = t.match(DATED)
  if (dated) {
    const [yy, mm, dd] = dated[0].trim().split(/[ ._-]/).map(Number)
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) sceneDate = `Scene ${dd} ${MONTHS[mm - 1]} ${2000 + yy}` // all that tells two file-name titles of one performer apart
  }
  const body = stripDated(t)
  if (body !== null) t = body // file-name style: the date and the code are not part of the title
  t = t.replace(/\b(?:2160p|1080p|720p|480p|4k|uhd|fhd|xxx|full (?:scene|video|movie)|upscaled?)\b/gi, ' ') // file-quality words are not part of a scene's title
  t = t.replace(/\s+(?=[a-z]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{4}\s*$/i, '') // an upload code at the very end ("... (09.11.2025) a8gn")
  // a lower-case tag glued to the end of a title ("... Gorgeous Body surprise", "... Misty - girl-masturbating") is spam, not the scene's name
  const words = t.trim().split(/\s+/)
  const content = words.slice(0, -1).filter((w) => /[A-Za-z]/.test(w) && !/^(?:a|an|the|of|in|on|at|to|for|with|and|or|her|his|from|by|y)$/i.test(w))
  if (content.length >= 3 && content.every((w) => /^[A-Z]/.test(w)) && /^[a-z]{3,}(?:-[a-z]+)*$/.test(words[words.length - 1])) { words.pop(); t = words.join(' ') } // a Title Case title with a lower-case last word
  for (const name of cast) t = t.replace(new RegExp(`\\b${escapeRe(name)}\\b`, 'ig'), ' ')
  t = t.replace(/\|/g, ' – ').replace(/\s+[-–—:]+\s+/g, ' – ')
  // what is left where a name was removed: empty brackets, bare commas, hanging connectors ("Fisting With , , & !" -> "Fisting!")
  t = t.replace(/\(\s*[,&\s]*\)/g, ' ').replace(/(?:\s*[,&]\s*)+(?=\s*(?:[!?.)]|–|$))/g, ' ')
  for (let i = 0; i < 4; i++) t = t.replace(/(^|\s)(?:and|&|with|feat\.?|starring)(?=\s*(?:–|[!?.,;)]|$))/gi, ' ').replace(/\s+$/, '')
  t = t.replace(/^\s*(?:in|with|and|&)\s+/i, '').replace(/\s+([!?.,;:])/g, '$1')
  t = t.replace(/\s{2,}/g, ' ').replace(/^[\s,&–—:|-]+|[\s,&–—:|-]+$/g, '').replace(/(?:\s–){2,}/g, ' –').trim()
  t = t.split(' – ').filter((seg) => seg.replace(/[^A-Za-z0-9]/g, '').length > 1).join(' – ') // a lone "Y" between separators is a leftover
  if (!t && sceneDate) return sceneDate
  if (ucRatio(t) > 0.6 || (t && (t.match(/[A-Z]/g) || []).length <= 1)) t = titleCase(t) // SHOUTED, all-lower-case or sentence-case titles
  // single shouted words ("ANAL EXAM", "HUGE DICK") become normal words; acronyms stay
  t = t.replace(/\b[A-Z]{4,}\b/g, (w) => (ACRONYMS.has(w) ? w : w[0] + w.slice(1).toLowerCase()))
  t = t.replace(/\b(Don|Can|Won|Isn|Aren|Didn|Doesn|Couldn|Wouldn|Shouldn|Wasn|Weren|Haven|Hasn|Hadn) T\b/g, "$1't").replace(/\b(We|You|They) Re\b/g, "$1're").replace(/\b(I|You|We|They|He|She|It|That) Ll\b/g, "$1'll")
  return t.replace(/\.+$/, '').replace(/\b(?:dp|bbc|bwc|pov|milf|bbw|asmr|joi|pawg|gilf|dilf|jav|vr|xxx)\b/gi, (w) => w.toUpperCase())
}
const ACRONYMS = new Set(['MILF', 'PAWG', 'GILF', 'BBW', 'JAV', 'DILF', 'POV'])

// Cut at a word, then drop what would dangle ("Gets A New", "Through", "And"): a cut title should still read as a phrase
const TAIL_WORD = /\s+(?:a|an|the|of|in|with|and|or|to|for|her|his|their|my|your|our|on|at|by|from|through|into|onto|over|under|after|before|about|between|but|as|that|this|some|up|off)$/i
const TAIL_PAIR = /\s+(?:a|an|the|her|his|their|my|your|our|this|that|some)\s+\S+$/i
function clipWords(text, max) {
  if (text.length <= max) return text
  let cut = text.slice(0, max + 1).replace(/\s+\S*$/, '').replace(/[\s,–—:&-]+$/, '')
  for (let i = 0; i < 4; i++) {
    const before = cut
    cut = cut.replace(TAIL_PAIR, '').replace(TAIL_WORD, '').replace(/[\s,–—:&-]+$/, '')
    if (cut === before) break
  }
  return cut
}

// The title shown on the site: "Cast – Scene (Studio)"
export function buildTitle({ cast = [], rawTitle, studio }) {
  const scene = clipWords(sceneTitle(rawTitle, cast, studio), 80)
  const castPart = cast.slice(0, 3).join(' & ')
  if (castPart && scene.length >= 4) return `${castPart} – ${scene} (${studio.name})`
  if (scene.length >= 4) return `${scene} (${studio.name})`
  return `${castPart || studio.name} – ${studio.name} Scene`.replace(/^(.+) – \1 Scene$/, '$1 Scene')
}

// The search title: 30-53 characters, "Cast – Scene – Studio"
export function buildSeoTitle({ cast = [], rawTitle, studio, minutes }) {
  const scene = sceneTitle(rawTitle, cast, studio)
  const suffix = ` – ${studio.name}`
  const MIN_SCENE = 14 // a shorter cut of the scene says too little
  // try two performers with the scene, then the first performer with the scene
  for (const names of [cast.slice(0, 2), cast.slice(0, 1)]) {
    if (!names.length || scene.length < 4) continue
    const prefix = names.join(' & ')
    const room = 53 - suffix.length - prefix.length - 3
    if (room < MIN_SCENE && room < scene.length) continue
    const s = clipWords(scene, room)
    if (s.length >= Math.min(MIN_SCENE, scene.length)) return `${prefix} – ${s}${suffix}`
  }
  let head = cast.length ? cast.slice(0, 2).join(' & ') : clipWords(scene, 53 - suffix.length)
  if (head.length > 53 - suffix.length) head = clipWords(cast[0] || head, 53 - suffix.length) // very long names: the first performer only
  const t = `${head}${suffix}`
  return t.length < 30 ? `${head} – ${minutes} Min${suffix}`.slice(0, 53) : t // the studio name always stays
}

// The title of the video, or — when another video already has it, or it comes out too short — the
// next variant that is still honest and still names the studio: the other performer first, the
// first performer alone, the length, then the most searched tag. `taken` is a Set of lower-case titles.
export function buildSeoTitleUnique({ cast = [], rawTitle, studio, minutes, tags = [] }, taken = new Set()) {
  const suffix = ` – ${studio.name}`
  const fits = (t) => t.length >= 30 && t.length <= 53 && !taken.has(t.toLowerCase())
  const scene = sceneTitle(rawTitle, cast, studio)
  const tag = tags.find((t) => slugify(t) !== slugify(studio.name)) || ''
  const tries = [
    () => buildSeoTitle({ cast, rawTitle, studio, minutes }),
    () => buildSeoTitle({ cast: cast.slice(0, 1), rawTitle, studio, minutes }),
    () => (cast.length > 1 ? buildSeoTitle({ cast: [cast[1], cast[0]], rawTitle, studio, minutes }) : ''),
    () => (cast.length > 1 ? buildSeoTitle({ cast: cast.slice(1, 2), rawTitle, studio, minutes }) : ''),
  ]
  for (const t of tries) { const s = t(); if (s && fits(s)) return s }
  // add the length, then the tag, and shorten the scene to make room
  const lead = cast.slice(0, 1).join('') || ''
  for (const extra of [`${minutes} Min`, tag, tag ? `${tag} ${minutes} Min` : '']) {
    if (!extra) continue
    for (const head of [lead ? `${lead} – ${scene}` : scene, scene]) {
      const room = 53 - suffix.length - extra.length - 3
      if (room < 10) continue
      const s = `${clipWords(head, room)} ${extra}${suffix}`.replace(/\s+/g, ' ')
      if (fits(s)) return s
      const s2 = `${clipWords(head, room - 1)} – ${extra}${suffix}`
      if (s2.length <= 53 && fits(s2)) return s2
    }
  }
  return buildSeoTitle({ cast, rawTitle, studio, minutes }) // the caller reports it as a duplicate or a short title
}

// ---- search description (140-160 characters) -------------------------------------------------
function hash(text) {
  let h = 2166136261
  for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return h
}

// Leads that name the studio, the performers, the length and the most searched tags; the closing
// sentence and a second sentence are added until the text is 140-160 characters.
export function buildSeoDescription({ slug, studio, cast = [], minutes, tags = [], source = 'Eporner', scene = '' }) {
  const descriptive = tags.filter((t) => slugify(t) !== slugify(studio.name))
  const who = cast.length ? listJoin(cast.slice(0, 2)) : null
  const noun = hash(`${slug}:n`) % 2 ? 'scene' : 'video'
  // the scene's own title (its words are what makes two videos of one studio different and findable)
  const phrase = scene.length >= 8 ? clipWords(scene, 42).replace(/[\s.,;:!?–—-]+$/, '') : ''
  const leads = []
  for (const n of [3, 2, 4, 1]) {
    const tagText = descriptive.slice(0, n).length ? `, tagged ${listJoin(descriptive.slice(0, n))}` : ''
    if (phrase) {
      leads.push(
        who ? `${who} in "${phrase}": ${aOrAn(`${minutes}-minute`)} ${minutes}-minute ${studio.name} ${noun}${tagText}.` : `${studio.name} porn video "${phrase}", ${minutes} minutes${tagText}.`,
      )
    }
    leads.push(
      who ? `${studio.name} porn video with ${who}: ${aOrAn(`${minutes}-minute`)} ${minutes}-minute ${noun}${tagText}.` : `${studio.name} porn video, ${minutes} minutes${tagText}.`,
      who ? `${who} in ${aOrAn(`${minutes}-minute`)} ${minutes}-minute ${studio.name} ${noun}${tagText}.` : `${studio.name} ${noun} of ${minutes} minutes${tagText}.`,
    )
  }
  const tails = ['Cast, tags and length on VEXN.', 'Details and cast on VEXN.', 'Watch it on VEXN.', `Plays from ${source}; details on VEXN.`]
  const extras = [
    '', 'Each video page lists the runtime and tags.', 'It plays in an embedded player from the source site.',
    'The video is not hosted on VEXN.', 'Each video page lists the runtime and tags. It plays in an embedded player from the source site.',
  ]
  const start = hash(`${slug}:t`)
  const candidates = []
  for (const extra of extras) for (const lead of leads) for (let i = 0; i < tails.length; i++) candidates.push(`${lead} ${tails[(start + i) % tails.length]}${extra ? ` ${extra}` : ''}`)
  const fit = candidates.find((c) => c.length >= 140 && c.length <= 160)
  if (fit) return fit
  const best = [...candidates].sort((a, b) => Math.abs(150 - a.length) - Math.abs(150 - b.length))[0]
  return best.length > 160 ? best.slice(0, 157).replace(/\s+\S*$/, '') + '.' : best
}

// A slug that names the cast, the scene and the studio
export const buildSlug = ({ cast = [], rawTitle, studio }) => slugify(`${cast.slice(0, 2).join(' ')} ${sceneTitle(rawTitle, cast, studio)} ${studio.name}`).slice(0, 110).replace(/-+$/, '')

// Eporner's thumbnail path holds the numeric id and the picture number; the site shows the larger imggen copy of it
export function posterFrom(defaultThumbSrc) {
  const m = String(defaultThumbSrc || '').match(/\/(\d{5,9})\/(\d{1,2})_\d+\.jpg$/)
  return m ? { large: `https://imggen.eporner.com/${m[1]}/1280/720/${m[2]}.jpg`, small: defaultThumbSrc } : { large: null, small: defaultThumbSrc || null }
}
