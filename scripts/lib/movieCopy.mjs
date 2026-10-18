// Drafts a factual on-page description, search description and search title for a movie row
// (plan T8 / section 14.7). It only uses what the row states: credited cast, runtime, descriptive
// tags, channel, source, and a setting or episode number that the title itself names. It makes no
// quality claim ("HD", "steamy", "most watched") and no claim about what happens in a scene.
// The wording varies by row (chosen from the slug, so a rerun gives the same text) and every text is checked
// for length. Used by scripts/rewrite-movie-copy.mjs; a human can still edit any row in the admin form.
import { LABEL_TAGS } from '../../src/lib/categories.js'
import { checkContent } from '../../src/lib/contentRules.js'
import { slugify } from '../../src/lib/slugify.js'

function hash(text) {
  let h = 2166136261
  for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return h
}
const pick = (list, slug, slot) => list[hash(`${slug}:${slot}`) % list.length]

const KEEP_LABELS = new Set(['4k']) // a resolution tag still says something about the video
const SETTINGS = [
  [/\boffice\b/i, 'an office'], [/\bhotel\b/i, 'a hotel'], [/\bgym\b/i, 'a gym'], [/\bkitchen\b/i, 'a kitchen'],
  [/\bbathroom\b/i, 'a bathroom'], [/\bshower\b/i, 'a shower'], [/\bpool\b/i, 'a pool'], [/\bbeach\b/i, 'a beach'],
  [/\blibrary\b/i, 'a library'], [/\bgarage\b/i, 'a garage'], [/\bbalcony\b/i, 'a balcony'], [/\bbedroom\b/i, 'a bedroom'],
  [/\bspa\b/i, 'a spa'], [/\byoga\b/i, 'a yoga session'], [/\bcar\b/i, 'a car'], [/\brooftop\b/i, 'a rooftop'],
  [/\bsofa\b|\bcouch\b/i, 'a sofa'], [/\bforest\b/i, 'a forest'], [/\btrain\b/i, 'a train'], [/\bboat\b/i, 'a boat'],
]

export function descriptiveTags(movie) {
  const channelSlug = slugify(movie.channel || '')
  const seen = new Set()
  const out = []
  for (const raw of String(movie.tags || '').split(',')) {
    const name = raw.trim()
    const slug = slugify(name)
    if (!slug || seen.has(slug) || slug === channelSlug) continue
    if (LABEL_TAGS.has(slug) && !KEEP_LABELS.has(slug)) continue
    seen.add(slug)
    out.push(name)
  }
  return out
}

// "an 18-minute clip", "an 8-minute video", "a 15-minute scene", "a short clip"
export function aOrAn(phrase) {
  return /^(?:8|11|18|8\d)(?!\d)|^[aeiou]/i.test(String(phrase)) ? 'an' : 'a'
}
const cap = (text) => `${text[0].toUpperCase()}${text.slice(1)}`

export const listJoin = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

function castOf(movie) {
  return String(movie.actors || '').split(',').map((s) => s.trim()).filter(Boolean)
}
function castText(names) {
  if (names.length <= 3) return listJoin(names)
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} ${names.length - 3 === 1 ? 'other' : 'others'}`
}
function runtimeKind(mins) {
  if (!Number.isFinite(mins) || mins <= 0) return null
  if (mins < 12) return 'short'
  if (mins < 45) return 'scene'
  if (mins < 90) return 'long'
  return 'feature'
}
function runtimePhrase(movie, slug) {
  const m = movie.runtime_minutes
  const k = runtimeKind(m)
  if (!k) return pick(['video', 'scene', 'clip'], slug, 'norun')
  if (k === 'short') return pick([`short clip of about ${m} minutes`, `${m}-minute clip`, `short scene of about ${m} minutes`], slug, 'rt')
  if (k === 'scene') return pick([`scene of about ${m} minutes`, `${m}-minute scene`, `video of about ${m} minutes`], slug, 'rt')
  if (k === 'long') return pick([`long scene of about ${m} minutes`, `${m}-minute video`, `longer video of about ${m} minutes`], slug, 'rt')
  return pick([`feature-length video of about ${m} minutes`, `full-length video of about ${m} minutes`, `${m}-minute feature`], slug, 'rt')
}
function titleFacts(movie) {
  const t = String(movie.title || '')
  const facts = []
  const place = SETTINGS.find(([re]) => re.test(t))
  if (place) facts.push(place[1])
  const ep = t.match(/\b(?:episode|ep)\.?\s*0?(\d{1,3})\b/i) || t.match(/\bS\d{1,2}\s?E0?(\d{1,3})\b/i)
  const part = t.match(/\bpart\s*0?(\d{1,2})\b/i)
  return { place: place ? place[1] : null, episode: ep ? Number(ep[1]) : null, part: part ? Number(part[1]) : null }
}

export function draftDescription(movie) {
  const slug = movie.slug
  const cast = castOf(movie)
  const tags = descriptiveTags(movie).slice(0, 5)
  const tagText = listJoin(tags)
  const rt = runtimePhrase(movie, slug)
  const verb = pick(['stars in', 'appears in', 'features in'], slug, 'verb')
  const parts = []

  // 1. who and what
  if (cast.length) {
    const who = castText(cast)
    const open = pick([
      () => `${who} ${cast.length === 1 ? verb : 'appear in'} this ${rt}${tagText ? `, tagged ${tagText}` : ''}.`,
      () => `This ${rt} features ${who}${tagText ? ` and is tagged ${tagText}` : ''}.`,
      () => `${rt[0].toUpperCase()}${rt.slice(1)} with ${who}${tagText ? `, tagged ${tagText}` : ''}.`,
    ], slug, 'open')
    parts.push(open())
  } else {
    const open = pick([
      () => `${cap(aOrAn(rt))} ${rt}${tagText ? `, tagged ${tagText}` : ''}. No performers are listed.`,
      () => `This ${rt} is tagged ${tagText || 'without descriptive tags'}; no performers are listed.`,
      () => `${rt[0].toUpperCase()}${rt.slice(1)}${tagText ? ` tagged ${tagText}` : ''}, with no performers listed.`,
    ], slug, 'open')
    parts.push(open())
  }

  // 2. what the title itself says
  const f = titleFacts(movie)
  const extra = []
  if (f.place) extra.push(`The title places it in ${f.place}`)
  if (f.episode) extra.push(`it is episode ${f.episode} of a series`)
  else if (f.part) extra.push(`it is part ${f.part} of a series`)
  if (extra.length) parts.push(`${extra.join(', and ')[0].toUpperCase()}${extra.join(', and ').slice(1)}.`)

  parts.push(sourceLine(movie), closerLine(movie))
  return padDescription(parts.join(' '), slug)
}

// 3. where it comes from
function sourceLine(movie) {
  const slug = movie.slug
  const from = movie.source ? `from ${movie.source}` : 'from the source site'
  return movie.channel
    ? pick([
        () => `It is listed in the ${movie.channel} channel and plays in an embedded player ${from}.`,
        () => `It comes from the ${movie.channel} channel and plays in an embedded player ${from}.`,
      ], slug, 'src')()
    : pick([
        () => `It plays in an embedded player ${from}.`,
        () => `The video plays in an embedded player ${from}, not on VEXN.`,
        () => `VEXN embeds the player ${from}; the video is not hosted here.`,
      ], slug, 'src')()
}

// 4. where to go next
function closerLine(movie) {
  const cast = castOf(movie)
  const tags = descriptiveTags(movie)
  const closers = []
  if (cast.length) closers.push(() => `The ${cast[0]} page lists ${cast.length === 1 ? "the performer's" : 'more'} videos on VEXN.`)
  if (tags[0]) closers.push(() => `The ${tags[0]} category lists similar videos.`)
  closers.push(() => 'The tags above the player lead to similar videos.', () => 'Each video page shows the cast, tags and length before you press play.')
  return pick(closers, movie.slug, 'close')()
}

// a short, uncredited clip can fall under the 200-character minimum: state what the page lists
function padDescription(text, slug) {
  if (text.length >= 200) return text
  const pad = pick([
    'The runtime, tags and source are listed on this page.',
    'This page lists the runtime, the tags and where the video plays from.',
    'Runtime, tags and source are shown on this page.',
  ], slug, 'pad')
  return `${text} ${pad}`
}

// Joins each lead to a closing sentence (and, if the lead is short, a second one) until the text
// is 140-160 characters. Returns null when no combination fits.
function fitSeo(leads, movie, used = new Set()) {
  const tails = [
    'Details and cast on VEXN.', 'Watch it on VEXN.', 'Open it on VEXN for the cast and tags.',
    `Plays from ${movie.source || 'the source site'}; details on VEXN.`, 'Cast, tags and length on VEXN.',
  ]
  const extras = [
    '', 'Each video page lists the runtime and tags.', 'The page shows the runtime, tags and source.', 'It plays in an embedded player from the source site.',
    'The video is not hosted on VEXN.', 'Each video page lists the runtime and tags. It plays in an embedded player from the source site.',
    'The page shows the runtime, tags and source. The video is not hosted on VEXN.',
  ]
  const start = hash(`${movie.slug}:seo-tail`)
  const candidates = []
  for (const extra of extras) {
    for (const lead of leads) {
      for (let i = 0; i < tails.length; i++) candidates.push(`${lead} ${tails[(start + i) % tails.length]}${extra ? ` ${extra}` : ''}`)
    }
  }
  const fit = candidates.find((c) => c.length >= 140 && c.length <= 160 && !used.has(c.toLowerCase()))
  if (fit) return fit
  return { closest: [...candidates].sort((a, b) => Math.abs(150 - a.length) - Math.abs(150 - b.length))[0] }
}

export function draftSeoDescription(movie, used = new Set()) {
  const slug = movie.slug
  const cast = castOf(movie)
  const tags = descriptiveTags(movie)
  const m = movie.runtime_minutes
  const mins = Number.isFinite(m) && m > 0 ? `${m}-minute ` : ''
  const noun = pick(['video', 'scene', 'clip'], slug, 'seo-noun')
  const k = runtimeKind(m)
  const kindNoun = k === 'feature' ? 'full-length video' : k === 'short' ? 'short clip' : noun
  const subject = cast.length ? castText(cast.slice(0, 2)) : null
  // the video's own title first (it is what tells two videos with the same cast and tags apart),
  // then leads built from the cast alone
  const title = baseTitle(movie)
  const titleHasCast = cast.length > 0 && title.toLowerCase().includes(cast[0].toLowerCase())
  const withCast = subject && !titleHasCast ? ` with ${subject}` : ''
  const titleLeads = []
  const nameLeads = []
  for (let nTags = Math.min(3, tags.length); nTags >= Math.min(1, tags.length); nTags--) {
    const tagPart = nTags ? ` tagged ${listJoin(tags.slice(0, nTags))}` : ''
    if (title && title.length <= 90 && !CLAIMS.test(title)) titleLeads.push(`${title}${withCast}: ${aOrAn(`${mins}${kindNoun}`)} ${mins}${kindNoun}${tagPart}.`.replace(/\.\.$/, '.'))
    nameLeads.push((subject
      ? `${subject} in ${aOrAn(`${mins}${kindNoun}`)} ${mins}${kindNoun}${tagPart}.`
      : `${cap(`${movie.channel ? `${movie.channel} ` : ''}${mins}${kindNoun}`)}${tagPart}. No performers are listed.`).replace(/\.\.$/, '.'))
  }
  const fit = fitSeo([...titleLeads, ...nameLeads], movie, used)
  if (typeof fit === 'string') return fit
  // nothing fits: trim the closest one at a word boundary
  const best = fit.closest
  return best.length > 160 ? best.slice(0, 157).replace(/\s+\S*$/, '') + '.' : best
}

// ---- keep what is already good ------------------------------------------------------------
// Wording the site cannot back (picture quality, popularity, "no signup") or that is only a search
// pitch. Sentences that match are dropped; sentences that do not are kept as they are.
export const CLAIMS = /\b(?:hd|full hd|1080p|720p|2160p|steamy|viral|raw|authentic|trending|most[- ]watched|top[- ]rated|best|hottest|sizzling|stunning|incredible|crisp|passionate|intense|must[- ]watch|brings? the heat|delivers?|solid pick|popular with|belongs on your watchlist|perfect for|ideal for|sign ?up|downloads?|streams? (?:free|now|online|instantly)|stream (?:it )?free|free (?:to|in|full|hd|porn|video|scene|online)|watch (?:the )?(?:full|whole|it free)|looking for|searching|if you (?:search|like|love|enjoy)|available in|a good match|fans of|viewers who|new videos like|browse more videos|added regularly|more videos like it|free to watch|free on|free and|watchlist)\b/i

// "in 1080p", "in crisp full HD", "ultra-sharp 2160p": a picture-quality phrase inside an otherwise
// factual sentence is removed instead of dropping the whole sentence.
const RESOLUTION = /\s*\b(?:(?:in|shot in|presented in|streaming in|ultra[- ]sharp|sharp|crisp|stunning|clear|full)[,\s]+)*(?:hd|1080p|720p|2160p)\b(?:\s+quality)?|\s*\b(?:(?:in|shot in|presented in|streaming in|ultra[- ]sharp|sharp|crisp|stunning|clear)[,\s]+)+4k\b(?:\s+quality)?/gi
// ...unless that leaves the sentence hanging ("is shot in sharp.", "looks great throughout.")
const DANGLING = /\b(?:is|are|was|shot|runs|in|with|at|of|throughout)[\s,]*[.!]?$/i
export function scrubResolution(sentence) {
  const text = String(sentence)
  const scrubbed = text.replace(RESOLUTION, '').replace(/\s+([,.;:])/g, '$1').replace(/,\s*,/g, ',').replace(/,\s*([.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim()
  return scrubbed !== text && DANGLING.test(scrubbed) ? '' : scrubbed
}

const hasBlocked = (text) => checkContent({ description: text }).block.length > 0
// true when a text has no claim, no search pitch and no wording the site does not publish
export const isClean = (text) => !CLAIMS.test(text) && !hasBlocked(text)

// Sentences of `text` with no claim and no search pitch (questions are pitches).
export function factualSentences(text) {
  return String(text || '').split(/(?<=[.!?])\s+/).map((s) => scrubResolution(s)).filter(Boolean)
    .filter((s) => isClean(s) && !/\?$/.test(s))
    .filter((s) => !/embedded player|plays from|category lists|tags above|not hosted|page lists/i.test(s))
}

// The description keeps its clean opening sentences and gets the factual source and next-step
// lines instead of the pitch. null when too little is left to be worth keeping.
export function hybridDescription(movie, existing) {
  const lead = factualSentences(existing).slice(0, 2).join(' ')
  if (lead.length < 60) return null
  let text = `${lead} ${sourceLine(movie)} ${closerLine(movie)}`
  if (text.length > 420) text = `${lead} ${sourceLine(movie)}`
  return padDescription(text, movie.slug)
}

// The first clean sentence of the old search description, closed with a factual tail.
export function hybridSeoDescription(movie, existing, used = new Set()) {
  const lead = factualSentences(existing).find((s) => s.length >= 50 && s.length <= 118)
  if (!lead) return null
  const fit = fitSeo([lead.endsWith('.') ? lead : `${lead.replace(/[?!]$/, '')}.`], movie, used)
  return typeof fit === 'string' ? fit : null
}

// The video title without a "(36 Min)" or "(HD)" bracket or a trailing "– Free ..." pitch.
const NOISE = /\s*[(\[]\s*(?:\d+\s*min(?:ute)?s?|4k|hd|1080p|2160p|720p|uncensored)[^)\]]*[)\]]\s*/gi
function baseTitle(movie) {
  return String(movie.title || '').replace(NOISE, ' ').replace(/\s*[-–—]\s*(?:free|full|watch)[^-–—]*$/i, '').replace(/\s+/g, ' ').trim()
}
export function draftSeoTitle(movie) {
  // one kind of dash between the name and the rest ("A - B" becomes "A – B")
  let t = baseTitle(movie).replace(/\s-\s/g, ' – ')
  if (t.length > 53) t = t.slice(0, 53).replace(/[\s,&:–—-]+\S*$/, '').trim()
  return padTitle(t, movie)
}

// A short title gets the runtime (and, if still short, the site name) so it reaches 30 characters.
function padTitle(title, movie) {
  let t = title
  const m = movie.runtime_minutes
  const sep = t.includes(' – ') || t.includes(' — ') ? ',' : ' –' // one dash per title
  const adds = [Number.isFinite(m) && m > 0 ? `${sep} ${m} Min Video` : `${sep} Full Video`, ' on VEXN', `${sep} Cast and Tags`]
  for (const add of adds) {
    if (t.length >= 30) break
    if (t.length + add.length <= 53) t += add
  }
  return t
}

export function draftCopy(movie) {
  return { description: draftDescription(movie), seo_description: draftSeoDescription(movie), seo_title: draftSeoTitle(movie) }
}

// ---- search title: strip the pitch, keep the name ---------------------------------------
const TITLE_CLAIMS = /\b(?:hd|full hd|1080p|720p|2160p|steamy|viral|raw|best|hottest|free (?:hd|full|video|scene|porn|online)|watch (?:free|online|full))\b/i
// Only a pitch at the end is cut ("– HD", ", Full HD Scene", "– Free 1080p"); a claim in the middle
// of the title means the title is redrafted from the video title instead.
export function stripTitleClaims(seoTitle) {
  return String(seoTitle || '')
    .replace(/\s*[-–—,|]?\s*(?:(?:in|ultra|full|free)\s+)*(?:hd|1080p|720p|2160p)(?:\s+(?:video|scene|movie|porn|solo|feature))*\s*$/i, '')
    .replace(/\s*[-–—|]\s*(?:free|watch|full)\b[^-–—|]*$/i, '')
    .replace(/\s+/g, ' ').replace(/[\s,–—-]+$/, '').trim()
}
const inRange = (text, min, max) => text.length >= min && text.length <= max

// The row's search title: kept when it is already clean and 30-53 characters, cleaned of HD and
// "Free ..." pitches when that leaves a good title, otherwise drawn from the video title.
export function cleanSeoTitle(movie) {
  const current = String(movie.seo_title || '').trim()
  if (current && !TITLE_CLAIMS.test(current) && inRange(current, 30, 53)) return { value: current, mode: 'keep' }
  const stripped = stripTitleClaims(current)
  if (stripped && !TITLE_CLAIMS.test(stripped) && inRange(stripped, 15, 53)) return { value: padTitle(stripped, movie), mode: 'strip' }
  return { value: draftSeoTitle(movie), mode: 'draft' }
}

// What to do with one row: each field is kept when it is already clean, rebuilt from the clean
// part of the old text (hybrid) or drafted from the row's facts (draft).
// `used` holds the lowercase search descriptions already taken, so two videos never share one.
export function rewriteCopy(movie, used = new Set()) {
  const out = {}
  const mode = {}
  const d = String(movie.description || '')
  if (d.length >= 200 && isClean(d)) { out.description = d; mode.description = 'keep' }
  else {
    const h = hybridDescription(movie, d)
    out.description = h || draftDescription(movie)
    mode.description = h ? 'hybrid' : 'draft'
  }
  const s = String(movie.seo_description || '')
  if (inRange(s, 140, 160) && isClean(s)) { out.seo_description = s; mode.seo_description = 'keep' }
  else {
    const h = hybridSeoDescription(movie, s, used)
    out.seo_description = h || draftSeoDescription(movie, used)
    mode.seo_description = h ? 'hybrid' : 'draft'
  }
  const t = cleanSeoTitle(movie)
  out.seo_title = t.value
  mode.seo_title = t.mode
  return { ...out, mode }
}
