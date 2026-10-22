// Pure logic for importing Indian web-series episodes (Ullu, Fliz Movies, Rabbit Movies) from Eporner
// (scripts/import-eporner-webseries.mjs): which uploads qualify, how a messy upload title becomes a series name
// and an episode label, and how the title, tags and search texts are built. No network here, so it can be tested.
//
// The search texts follow the studio importer's formula (scripts/lib/studioImport.mjs): a search title of
// 30-53 characters, a search description of 140-160 characters that names the channel, the language, the length
// and the tags visitors search most (TREND, from the site's own traffic; "Indian" and "Desi" lead it), and no
// claims that cannot be checked (no HD, free, best, trending).
import { normalizeTags } from '../../src/lib/categories.js'
import { checkContent } from '../../src/lib/contentRules.js'
import { slugify } from '../../src/lib/slugify.js'
import { TREND, mapTags, mentionsBlowjob } from './studioImport.mjs'
import { aOrAn, listJoin } from './movieCopy.mjs'

export const CHANNELS = {
  ullu: { name: 'Ullu', brand: /\bullu\b/i, noise: /\bullu\b/gi, queries: ['ullu', 'ullu web series'] },
  'fliz-movies': { name: 'Fliz Movies', brand: /\bfliz\s?(?:movies?|web ?series)\b|\bflizmovies\b/i, noise: /\bfliz\s?(?:movies?|web ?series)\b|\bflizmovies\b|\bfliz\b/gi, queries: ['fliz movies', 'flizmovies', 'fliz web series'] },
  'rabbit-movies': { name: 'Rabbit Movies', brand: /\brabbit\s?(?:movies?|web ?series)\b|\brabbitmovies\b/i, noise: /\brabbit\s?(?:movies?|web ?series)\b|\brabbitmovies\b/gi, queries: ['rabbit movies', 'rabbitmovies', 'rabbit web series'] },
}

const LANGUAGES = ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Punjabi', 'Marathi', 'Bhojpuri']

// ---- who qualifies --------------------------------------------------------------------------------
// Hindi words for forced, family and in-law themes: the site does not publish them (src/lib/contentRules.js has
// the English ones and only some Desi relation words as "review"; here they are all refused, nobody reviews the rows)
const HINDI_BLOCK = /\b(?:jabardast\w*|zabardast\w*|balatkar\w*|mummy|mommy|mom|maa|papa|baap|beta|beti|bhai|bhaiya|behen|bahan|bhanja|bhanje|bhatij\w*|mama|mami|mausi|chachi|chacha|bua|fufa|sasur\w*|saas|damad|sali|saali|jija|jeth\w*|dev(?:a)?r|dever|devrani|nanad|nandoi|bahu|babuji|dadi|nani|father|mother|sister|brother|in ?low|relatives?|family|beti|vashikar\w*|nabalig|kuwari|kunwari|school\w*|schoolgirl|college|sleeping|sleep|bachpan)\b/i
const NOT_A_SERIES = /\b(?:bts|behind the scenes|trailer|teaser|promo|making of|compilation|all episodes|full season|complete season|season \d+ (?:all|full)|best of|scenes? collection)\b/i
const OFF_SCOPE = /\b(?:gay|trans(?:gender|sexual)?|shemale|tranny|ladyboy|crossdress\w*|femboy|sissy)\b/i
// a title that is a long Hindi sentence describing the scene is not a series title
const HINDI_FUNCTION = /\b(?:ne|ke|ki|ko|ka|main|mein|sath|saath|kiya|kari|kar|diya|dala|mara|choda|ghusaya|nanga|nangi|phir|apni|apne|ladki|biwi|pati|gand|land|chut|chudai|pela|bulaya|pakda)\b/gi

// Broken characters (UTF-8 read as Latin-1) turn dashes into "â" plus control characters and emoji into "ð...":
// dashes become separators, the rest is dropped
export function fixText(s) {
  return String(s || '')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[âÂÃð][\u0080-¿ -⁯]*/g, (m) => (m[0] === 'â' ? ' – ' : ' '))
    .replace(/[\u0080-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Why an upload does not qualify, or null. v: { title, keywords, length_sec }
export function excludeReason(v, channel, { minMinutes = 20, maxMinutes = 120 } = {}) {
  const minutes = (v.length_sec || 0) / 60
  if (minutes < minMinutes) return `under ${minMinutes} minutes`
  if (minutes > maxMinutes) return `over ${maxMinutes} minutes (not a single episode)`
  const title = fixText(v.title)
  const text = `${title} ${v.keywords || ''}`
  if (!channel.brand.test(title)) return 'channel not named in the title'
  if (NOT_A_SERIES.test(title)) return 'not an episode (trailer, behind the scenes, compilation)'
  if ((title.match(HINDI_FUNCTION) || []).length >= 3) return 'scene-description title'
  if (HINDI_BLOCK.test(text)) return `guard: ${text.match(HINDI_BLOCK)[0]}`
  if (mentionsBlowjob(text)) return 'blowjob'
  const hits = checkContent({ title, tags: v.keywords, keywords: v.keywords })
  if (hits.block.length) return `content rule: ${hits.block.map((h) => h.match).join(', ')}`
  if (hits.review.length) return `needs review: ${hits.review.map((h) => h.match).join(', ')}`
  if (OFF_SCOPE.test(text)) return `out of scope: ${text.match(OFF_SCOPE)[0]}`
  return null
}

// ---- title parsing --------------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0')
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(&"'-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
const NOISE = /\b(?:720p|1080p|2160p|480p|4k|uhd|fhd|hd|hdmaal|watch|free|download|full|videos?|movie|episodes?|uncut|originals?|exclusive|latest|new|hot|romantic|romance|sensational|story|adult|indian|sex|series|web ?series|hindi|tamil|telugu|malayalam|kannada|bengali|punjabi|marathi|bhojpuri|audio|sree|porn|pornx11|xxx|fucking|rajshot)\b/gi

// -> { series, year, season, part, ep, epEnd, language, label }  (series is '' when none can be found)
export function parseTitle(rawTitle, channel, keywords = '') {
  let t = fixText(rawTitle)
  const text = `${t} ${keywords}`
  const language = LANGUAGES.find((l) => new RegExp(`\\b${l}\\b`, 'i').test(text)) || 'Hindi'
  t = t.replace(/https?:\/\/\S+/g, ' ').replace(/\b[\w-]+\.(?:com|net|org|in|xyz|cc|co)\b/gi, ' ')
  t = t.replace(/\bUploading\b/i, ' ').replace(/\.mp4.*$/i, ' ').replace(/Speed:?\s*[\d.]+\s*Mbps/i, ' ').replace(/\[[^\]]*\]/g, ' ')
  t = t.replace(/\(?\b\d{1,2}\/\d{1,2}\/\d{2,4}\b\)?/g, ' ').replace(/\(\d{2}\/\d{5,6}\)/g, ' ')
  t = t.replace(/_/g, ' ').replace(/\.\s+/g, ' ').replace(/\.$/, '')
  if ((t.match(/-/g) || []).length >= 3 && !/\s-\s/.test(t)) t = t.replace(/-/g, ' ') // "Farebi-Ishq-(2024)-Season-01-Part-1"
  // "Sexy Indian lesbian hotel sex. Ullu indian web series. Anokha Rishta E3": the series is what follows "web series"
  const tail = t.match(/\bweb ?series\b[.\s,]+(\S.{2,50})$/i)
  if (tail && /\b(?:E|EP|Episodes?|Part|S)[\s.]*\d/i.test(tail[1])) t = tail[1]
  t = t.replace(channel.noise, ' ').replace(/\(\s*\)/g, ' ')
  let year = null
  const y = t.match(/\(?\b(20[12]\d)\b\)?/)
  if (y) { year = Number(y[1]); t = t.replace(y[0], ' ') }

  let season = null
  let part = null
  let ep = null
  let epEnd = null
  let m
  const MARK = ' ‖ '
  if ((m = t.match(/\bS(?:eason)?[\s.]*0*(\d{1,2})[\s,.\-]*(?:E|EP|Ep|Episodes?)[\s.]*\(?0*(\d{1,3})(?:\s*[-–]\s*0*(\d{1,3}))?\)?/i))) { season = +m[1]; ep = +m[2]; epEnd = m[3] ? +m[3] : null; t = t.replace(m[0], MARK) }
  else if ((m = t.match(/\bS(?:eason)?[\s.]*0*(\d{1,2})[\s,.\-]*(?:P|Part)[\s.]*0*(\d{1,2})\b/i))) { season = +m[1]; part = +m[2]; t = t.replace(m[0], MARK) }
  else if ((m = t.match(/\bSeason[\s.]*0*(\d{1,2})\b/i))) { season = +m[1]; t = t.replace(m[0], MARK) }
  // the first part and episode are read, every one is cut from the series name
  if ((m = t.match(/\bPart[\s.-]*0*(\d{1,2})\b|\bP(\d{2})\b/i))) { if (part == null) part = +(m[1] || m[2]); t = t.replace(/\bPart[\s.-]*0*\d{1,2}\b|\bP\d{2}\b/gi, MARK) }
  if ((m = t.match(/\b(?:EP|E|Episodes?)[\s.]*\(?0*(\d{1,3})(?:\s*[-–]\s*0*(\d{1,3}))?\)?(?![A-Za-z])/i))) { if (ep == null) { ep = +m[1]; epEnd = m[2] ? +m[2] : null } t = t.replace(/\b(?:EP|E|Episodes?)[\s.]*\(?0*\d{1,3}(?:\s*[-–]\s*0*\d{1,3})?\)?(?![A-Za-z])/gi, MARK) }

  let series = t.split('‖')[0]
  series = series.replace(NOISE, ' ').replace(/[()[\]{}]/g, ' ').replace(/[^\p{L}\p{N}'&\s-]/gu, ' ').replace(/\s+-\s+|^-+|-+$/g, ' ').replace(/\s+/g, ' ').trim()
  const words = series.split(' ').filter(Boolean)
  // the same word twice in a row ("Lalmirch Lalmirch") is an upload artefact
  series = words.filter((w, i) => i === 0 || w.length < 4 || w.toLowerCase() !== words[i - 1].toLowerCase()).join(' ') // short words repeat in real names ("De De Pyar De")
  if (/^[A-Z\s']+$/.test(series) || words.every((w) => !/[A-Z]/.test(w.slice(1)))) series = titleCase(series) // "Aah se Aaha tak" -> "Aah Se Aaha Tak"; "NaUmarKISima" stays
  const epText = ep != null ? pad(ep) + (epEnd ? '-' + pad(epEnd) : '') : ''
  let label = ''
  if (season != null && ep != null) label = `S${pad(season)}E${epText}${part != null ? ` Part ${part}` : ''}`
  else if (season != null && part != null) label = `S${pad(season)} Part ${part}`
  else if (season != null) label = `Season ${season}`
  else if (part != null && ep != null) label = `Part ${part} EP${epText}`
  else if (part != null) label = `Part ${part}`
  else if (ep != null) label = `EP${epText}`
  return { series, year, season, part, ep, epEnd, language, label }
}

// a usable series name: 4-40 characters, at most 5 words
export const usableSeries = (series) => series.length >= 4 && series.length <= 40 && series.split(' ').length <= 5

// ---- titles, slug ---------------------------------------------------------------------------------
const nameOf = (p, channel) => `${p.series}${p.label ? ` ${p.label}` : ''}`

// The title shown on the site: "Series (Year) Episode – Language Channel Web Series (31 Min)"
export function buildTitle(p, channel, minutes) {
  return `${p.series}${p.year ? ` (${p.year})` : ''}${p.label ? ` ${p.label}` : ''} – ${p.language} ${channel.name} Web Series (${minutes} Min)`
}

export const buildSlug = (p, channel) => slugify(`${p.series} ${p.year || ''} ${p.label} ${p.language} ${channel.name} web series`).slice(0, 110).replace(/-+$/, '')

function clip(text, max) {
  if (text.length <= max) return text
  return text.slice(0, max + 1).replace(/\s+\S*$/, '').replace(/[\s,–—:&-]+$/, '').replace(/\s+(?:a|an|the|of|in|and|ka|ki|ke|ko|se|ne)$/i, '')
}

// The search title: 30-53 characters, "Series Episode – Language Channel Web Series"
export function buildSeoTitle(p, channel, minutes) {
  const tails = [` – ${p.language} ${channel.name} Web Series`, ` – ${channel.name} Web Series`, ` – ${channel.name}`]
  for (const tail of tails) {
    const room = 53 - tail.length
    const label = p.label ? ` ${p.label}` : ''
    let head = `${p.series}${label}`
    if (head.length > room) head = `${clip(p.series, room - label.length)}${label}`
    if (head.length > room || clip(p.series, room).length < Math.min(10, p.series.length)) continue
    const t = `${head}${tail}`
    if (t.length >= 30) return t
    return `${head} – ${minutes} Min${tail}`.slice(0, 53)
  }
  return `${clip(p.series, 53 - 15)} – ${channel.name} Web Series`
}

// ---- tags, keywords --------------------------------------------------------------------------------
// Indian, Web Series, Desi, the language and the channel first, then up to three tags the upload's own
// keywords support, most searched first (region words repeat Indian, so they are left out)
const REGION_NOISE = new Set(['asian', 'japanese', 'jav', 'latina', 'interracial', 'indian', 'desi', 'hindi', 'web-series'])
export function tagsFor({ keywords, title, language, channel, freeAllowed = new Map() }) {
  const fromKeywords = mapTags(keywords, { name: channel.name }, freeAllowed, 8).split(', ').slice(1).filter((t) => !REGION_NOISE.has(slugify(t)))
  const fromTitle = []
  if (/\bromanc\w*|\bromantic\b/i.test(title)) fromTitle.push('Romantic')
  if (/\bbhabhi\b/i.test(title)) fromTitle.push('Bhabhi')
  const extras = [...new Set([...fromTitle, ...fromKeywords])]
    .map((name, i) => ({ name, i, w: TREND[slugify(name)] || 0 }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .slice(0, 3)
    .map((x) => x.name)
  return normalizeTags(['Indian', 'Web Series', 'Desi', language, channel.name, ...extras].join(', ')).tags
}

// ---- search description (140-160 characters) --------------------------------------------------------
function hash(text) {
  let h = 2166136261
  for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return h
}

export function buildSeoDescription({ slug, p, channel, minutes, tags = [] }) {
  const skip = new Set(['indian', 'web-series', 'desi', slugify(p.language), slugify(channel.name)])
  const descriptive = tags.filter((t) => !skip.has(slugify(t)))
  const name = nameOf(p, channel)
  const kind = p.label ? 'episode' : 'video'
  const leads = []
  for (const n of [3, 2, 1, 0]) {
    const tagText = n && descriptive.slice(0, n).length ? `, tagged ${listJoin(descriptive.slice(0, n))}` : ''
    leads.push(
      `${name} from ${channel.name}: ${aOrAn(`${minutes}-minute`)} ${minutes}-minute Indian desi ${p.language} web series ${kind}${tagText}.`,
      `${channel.name} ${p.language} web series ${name} (Indian, desi), ${minutes} minutes${tagText}.`,
      `Indian desi web series ${name} from ${channel.name}, ${minutes} minutes${tagText}.`,
    )
  }
  const tails = ['Watch it on VEXN.', 'Cast, tags and length on VEXN.', 'Details on VEXN.', 'Plays from Eporner; details on VEXN.']
  const extras = ['', 'Each video page lists the runtime and tags.', 'The video is not hosted on VEXN.', 'It plays in an embedded player from the source site.', 'Each video page lists the runtime and tags. The video is not hosted on VEXN.']
  const start = hash(`${slug}:t`)
  const lead0 = hash(`${slug}:l`) % 3
  const ordered = leads.map((_, i) => leads[(i + lead0) % leads.length])
  const candidates = []
  for (const extra of extras) for (const lead of ordered) for (let i = 0; i < tails.length; i++) candidates.push(`${lead} ${tails[(start + i) % tails.length]}${extra ? ` ${extra}` : ''}`)
  const fit = candidates.find((c) => c.length >= 140 && c.length <= 160)
  if (fit) return fit
  const best = [...candidates].sort((a, b) => Math.abs(150 - a.length) - Math.abs(150 - b.length))[0]
  return best.length > 160 ? best.slice(0, 157).replace(/\s+\S*$/, '') + '.' : best
}

// ---- on-page description (200-450 characters) ---------------------------------------------------------
export function buildDescription({ slug, p, channel, minutes, tags = [] }) {
  const skip = new Set(['indian', 'web-series', 'desi', slugify(p.language), slugify(channel.name)])
  const descriptive = tags.filter((t) => !skip.has(slugify(t))).slice(0, 4)
  const name = nameOf(p, channel)
  const kind = p.label ? 'episode' : 'video'
  const tagText = descriptive.length ? `, tagged ${listJoin(descriptive)}` : ''
  const intros = [
    `${name} is ${aOrAn(`${minutes}-minute`)} ${minutes}-minute ${p.language} web series ${kind} from the ${channel.name} channel${tagText}.`,
    `${aOrAn(`${minutes}-minute`)[0].toUpperCase()}${aOrAn(`${minutes}-minute`).slice(1)} ${minutes}-minute ${p.language} desi web series ${kind}, ${name}, listed in the ${channel.name} channel${tagText}.`,
    `This ${minutes}-minute ${p.language} web series ${kind} is ${name} from ${channel.name}${tagText}.`,
  ]
  const bodies = [
    'It plays in an embedded player from Eporner and is not hosted on VEXN. No performers are listed. The tags above the player lead to similar videos.',
    'The video plays in an embedded player from Eporner; VEXN does not host it. Each video page shows the runtime and tags before you press play.',
    'It is embedded from Eporner, where the video is hosted. The Indian and Desi category pages on VEXN list similar web series episodes and videos.',
  ]
  const h = hash(`${slug}:d`)
  return `${intros[h % intros.length]} ${bodies[(h >>> 3) % bodies.length]}`
}

export const buildKeywords = ({ p, channel, tags }) => [...new Set([channel.name, p.series, `${p.language} web series`, ...tags.filter((t) => slugify(t) !== slugify(channel.name))])].join(', ')
