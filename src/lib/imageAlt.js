// Alt text for images (owner request, Nov 2026).
//
// Built only from what the row really has: performers, its main category, the
// studio channel and the title. It never describes the picture itself, because
// nobody has looked at the frame Eporner picked as the poster.
//
//   cardAlt(movie)       video card poster   "Lena Paul and Ivy Lebelle threesome video from Vixen"
//   posterAlt(movie)     video page poster   "Pray for Me with Ivy Lebelle – threesome video poster"
//   tileAlt(name)        category/channel/performer tile   "MILF porn videos"
//
// A card already prints its title under the poster, so when a performer is
// known the card's alt names the people and the category instead of repeating
// the title. Only rows without a credited performer fall back to the title.
// The category is always one of the controlled categories (src/lib/categories.js),
// so a free tag never reaches the alt text.
import { slugify } from './slugify.js'
import { CONTROLLED_BY_SLUG, TAG_ALIASES } from './categories.js'
import { CATCH_ALL_CHANNELS } from './indexing.js'

const MAX_PEOPLE = 3
const MAX_TITLE = 80

const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean)
const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`)

// Category names as they read inside a sentence: proper adjectives and acronyms keep their capitals.
const KEEP_CASE = new Set(['Indian', 'Desi', 'Bhabhi', 'Hindi', 'Japanese', 'Asian', 'Latina', 'MILF', 'BBW', 'PAWG', 'POV'])
const IN_SENTENCE = new Map([['Jav', 'JAV'], ['Nuru Massage', 'Nuru massage']])
export function categoryWords(name) {
  if (IN_SENTENCE.has(name)) return IN_SENTENCE.get(name)
  return KEEP_CASE.has(name) ? name : name.toLowerCase()
}

// The first tag, in the row's own order, that is a controlled category (aliases count as their category).
export function mainCategory(tags) {
  for (const raw of list(tags)) {
    const slug = slugify(raw)
    const name = TAG_ALIASES.get(slug) ?? CONTROLLED_BY_SLUG.get(slug)
    if (name && CONTROLLED_BY_SLUG.has(slugify(name))) return CONTROLLED_BY_SLUG.get(slugify(name))
  }
  return null
}

// ["A"] -> "A", ["A", "B"] -> "A and B", ["A", "B", "C"] -> "A, B and C"
export function joinNames(names) {
  if (names.length <= 1) return names[0] || ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const performers = (movie) => list(movie.actors).slice(0, MAX_PEOPLE)
// The catch-all VEXN channel is not a studio, so it is not named.
const studio = (movie) => {
  const channel = String(movie.channel || '').trim()
  return channel && !CATCH_ALL_CHANNELS.has(slugify(channel)) ? channel : ''
}
const kind = (movie, noun) => {
  const category = mainCategory(movie.tags)
  return category ? `${categoryWords(category)} ${noun}` : noun
}

export function cardAlt(movie) {
  const names = joinNames(performers(movie))
  const from = studio(movie)
  const head = `${names ? `${names} ` : ''}${kind(movie, 'video')}${from ? ` from ${from}` : ''}`
  if (names) return capitalise(head)
  const title = clip(String(movie.title || '').trim(), MAX_TITLE)
  return title ? `${capitalise(head)}: ${title}` : capitalise(head)
}

export function posterAlt(movie) {
  const title = String(movie.title || '').trim()
  const inTitle = title.toLowerCase()
  const extra = performers(movie).filter((name) => !inTitle.includes(name.toLowerCase()))
  const what = kind(movie, 'video poster')
  if (!title) return capitalise(extra.length ? `${joinNames(extra)} ${what}` : what)
  return `${title}${extra.length ? ` with ${joinNames(extra)}` : ''} – ${what}`
}

export const tileAlt = (name) => `${String(name || '').trim()} porn videos`.trim()
