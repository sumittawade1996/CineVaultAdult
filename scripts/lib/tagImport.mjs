// Pure logic for importing the videos of one Eporner tag listing (scripts/import-eporner-tag.mjs), e.g.
// /tag/japanese-big-tits/top-monthly/. It reuses the studio importer's rules and builders: the tag's label
// ("Japanese Big Tits") stands where a studio's name would, in the search title, the search description and the
// address. The row's title ends in the length instead, because a tag is not a studio.
import { slugify } from '../../src/lib/slugify.js'
import { buildSeoDescription, buildSeoTitleUnique, buildSlug, clipWords, excludeReason, sceneTitle } from './studioImport.mjs'

// The listing as a "studio" for the shared builders (its brand never matches: no title has to name it)
export const tagBrand = (label) => ({ name: label, brand: /^$/, channels: [] })

// Eporner's keywords are separate words ("japanese, big tits, asian"), and a listing page also carries other videos
// than the tag's own, so a video qualifies only when every required tag is among its keywords (or a spelling of it).
const SPELLINGS = { 'big tits': ['big tits', 'big boobs', 'busty', 'natural tits', 'huge tits', 'big natural tits'] }
export function hasTags(keywords, required = []) {
  const have = new Set(String(keywords || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean))
  return required.every((tagName) => (SPELLINGS[tagName.toLowerCase()] || [tagName.toLowerCase()]).some((s) => have.has(s)))
}

// Titles that cannot be shown or that are not a title: UTF-8 read as Latin-1 ("æ¨ææç¾"), upload test names, and the
// Indonesian-language bokep uploads that Eporner mixes into Japanese listings
const MOJIBAKE = /[\u0080-\u009f]|[ÃÂâæçåäèéêë][ -¿]/
const FOREIGN_UPLOAD = /\b(?:hubungan|dengan|yang|istri|suami|tante|bokep|ngentot|jilbab|memek|colmek|sange|pembantu|kakak|adik|mengulang|teman)\b/i
// Studios that the shared guard does not know: a re-upload under another studio's name
const OTHER_BRAND = /\bwank ?zone\b|\bwankz\b/i
// A product code spread over single characters ("S W 5 6 7", "N H D T A 275") is not a title anyone can search
const SPLIT_CODE = /(?:^|\s)\S(?=\s)(?:\s+\S(?=\s|$)){2,}/

// A listing's videos come from many uploaders, so there is no studio to check: the length and the site's content
// rules decide (blowjob, school and age words, family themes, trans and gay content, compilations, unreadable titles),
// plus the tags the listing stands for and the title checks above. allowBlowjob: only for preparing a held set.
export function tagExcludeReason(v, tag, { minMinutes = 20, maxMinutes = 240, requireTags = [], allowBlowjob = false, selfBrand = null } = {}) {
  const title = v.title || ''
  if (MOJIBAKE.test(title)) return 'unreadable title'
  if (/^\s*test\b/i.test(title)) return 'test upload title'
  if (FOREIGN_UPLOAD.test(title)) return 'not an English title'
  if (OTHER_BRAND.test(title)) return 'names another studio'
  if (SPLIT_CODE.test(title)) return 'code-like title'
  if (!hasTags(v.keywords, requireTags)) return 'not tagged for this listing'
  return excludeReason(v, tag, { minMinutes, maxMinutes, verifiedChannel: true, allowBlowjob, selfBrand })
}

// "Marina Yuzuki – The Nipples Of … – Yuzuki Marina": the performer's name again in the other order is dropped from the title
export function dropReversedNames(title, cast = []) {
  let t = String(title || '')
  for (const name of cast) {
    const words = name.split(/\s+/)
    if (words.length !== 2) continue
    t = t.replace(new RegExp(`\\b${words.reverse().join('\\s+')}\\b`, 'ig'), ' ')
  }
  return t.replace(/\s{2,}/g, ' ').trim()
}

// "Cast – Scene (45 Min)", or the scene alone; '' when there is nothing to name the video by
export function buildTagTitle({ cast = [], rawTitle, tag, minutes }) {
  const scene = clipWords(sceneTitle(rawTitle, cast, tag), 80)
  const castPart = cast.slice(0, 3).join(' & ')
  const head = castPart && scene.length >= 4 ? `${castPart} – ${scene}` : scene.length >= 4 ? scene : ''
  return head ? `${head} (${minutes} Min)` : ''
}

// The search title: 30-53 characters, "Cast – Scene – Japanese Big Tits"
export const buildTagSeoTitle = (args, taken) => buildSeoTitleUnique({ ...args, studio: args.tag }, taken)

// The search description (140-160 characters). The tag's own words are left out of "tagged ...": the lead has them already.
export function buildTagSeoDescription({ slug, tag, cast, minutes, tags, scene }) {
  const own = new Set(tag.name.split(/\s+/).map(slugify))
  const rest = tags.filter((t) => !own.has(slugify(t)) && !slugify(tag.name).includes(slugify(t)))
  return buildSeoDescription({ slug, studio: tag, cast, minutes, tags: rest, scene })
}

export const buildTagSlug = ({ cast, rawTitle, tag }) => buildSlug({ cast, rawTitle, studio: tag })
