// Controlled category list (plan T22).
//
// Tags stay free text, but the topics people search for are a short, fixed set
// of about 55 names. Those get category pages, hand-written intros
// (scripts/data/category-descriptions.mjs) and a place in the sitemap once they
// have enough titles (src/lib/indexing.js). Everything else is a free tag:
// it can be shown on a video and has its own page, which stays out of the
// index until it is large enough.
//
//   CONTROLLED_CATEGORIES  the fixed topics, grouped
//   LABEL_TAGS             quality, source and format labels (HD, 4K, a studio
//                          name, "Web Series 2026"): attributes, never topics
//   TAG_ALIASES            spelling or wording variants that mean a controlled
//                          tag; the importer and the admin form rewrite them
//
// `npm run tag-report` lists how the live catalogue sits against this list.

import { slugify } from './slugify.js'

export const CONTROLLED_CATEGORIES = {
  'Region and language': ['Indian', 'Desi', 'Bhabhi', 'Hindi', 'Japanese', 'Jav', 'Asian', 'Latina', 'Interracial'],
  'Who': ['MILF', 'Mature', 'Housewives', 'BBW', 'Amateur', 'Homemade', 'Wife'],
  'Look': ['Big Tits', 'Big Ass', 'Big Dick', 'Small Tits', 'Brunette', 'Blonde', 'Redhead', 'Petite', 'PAWG'],
  'Acts': ['Blowjob', 'Handjob', 'Anal', 'Creampie', 'Cumshot', 'Masturbation', 'Hardcore', 'Squirt', 'Double Penetration'],
  'Groups': ['Threesome', 'Group Sex', 'Lesbian', 'Swinger', 'Cuckold'],
  'Style and setting': ['Romantic', 'Roleplay', 'Cheating', 'Fetish', 'POV', 'Massage', 'Lingerie', 'Outdoor', 'Public', 'Hotel', 'Shower', 'Webcam', 'Toys', 'Striptease', 'Erotic', 'Nuru Massage'],
}

export const CONTROLLED_NAMES = Object.values(CONTROLLED_CATEGORIES).flat()

// slug -> canonical name
export const CONTROLLED_BY_SLUG = new Map(CONTROLLED_NAMES.map((n) => [slugify(n), n]))

export const LABEL_TAGS = new Set([
  'hd', '4k', '2k', '1080p', '60fps', '60-fps', 'full-hd',
  'pornstar', 'web-series', 'web-series-2024', 'web-series-2026',
  'brazzers', 'reality-kings', 'vixen', 'blacked', 'ibamovies', 'ullu',
  'ai-generated', 'trending', 'adult', 'nude', 'nude-movies', 'semi-adult',
  'uncut', 'uncensored', 'long-feature', 'short-film', 'compilation',
])

// slug of the variant -> name to use instead
export const TAG_ALIASES = new Map([
  ['housewife', 'Housewives'],
  ['romance', 'Romantic'],
  ['hindi-audio', 'Hindi'],
  ['60-fps', '60FPS'],
  ['web-series-2024', 'Web Series'],
  ['web-series-2026', 'Web Series'],
  ['cheating-wife', 'Cheating'],
  ['infidelity', 'Cheating'],
  ['affair', 'Cheating'],
  ['gangbang', 'Group Sex'],
  ['orgy', 'Group Sex'],
  ['fat', 'BBW'],
  ['smooch', 'Kissing'],
  ['nuru', 'Nuru Massage'],
])

// -> 'controlled' | 'alias' | 'label' | 'free'
export function classifyTag(name) {
  const slug = slugify(name)
  if (TAG_ALIASES.has(slug)) return 'alias'
  if (CONTROLLED_BY_SLUG.has(slug)) return 'controlled'
  if (LABEL_TAGS.has(slug)) return 'label'
  return 'free'
}

// "Housewife, Romance, big tits" -> { tags: "Housewives, Romantic, Big Tits", changes: [...] }
// Aliases are replaced, controlled names get their standard capitalisation,
// duplicates (by slug) are dropped. Free tags are left exactly as written.
export function normalizeTags(input) {
  const seen = new Set()
  const out = []
  const changes = []
  for (const raw of String(input || '').split(',')) {
    const name = raw.trim()
    if (!name) continue
    const slug = slugify(name)
    if (!slug) continue
    let next = name
    if (TAG_ALIASES.has(slug)) next = TAG_ALIASES.get(slug)
    else if (CONTROLLED_BY_SLUG.has(slug)) next = CONTROLLED_BY_SLUG.get(slug)
    const nextSlug = slugify(next)
    if (seen.has(nextSlug)) {
      if (next !== name) changes.push({ from: name, to: next, dropped: true })
      continue
    }
    seen.add(nextSlug)
    out.push(next)
    if (next !== name) changes.push({ from: name, to: next })
  }
  return { tags: out.join(', '), changes }
}
