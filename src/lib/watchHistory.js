import { slugify } from './slugify'
import { isBot } from './isBot'

// Remembers, on this device only (localStorage, no cookie and nothing sent to
// the server), the last video a visitor opened and which tags they open most.
// The "Watch" shortcut buttons read it so a returning visitor lands straight
// on what they were watching, or on their favourite category.

const KEY = 'vexn:watch:v1'
const CONTINUE_MAX_AGE = 30 * 24 * 3600 * 1000 // stop offering "Continue" after 30 days
const REOPEN_WINDOW = 30 * 60 * 1000 // refreshes of the same page within 30 min don't count again
const MAX_TAGS = 40
const MIN_FAVORITE = 2 // a tag becomes a "favourite" after 2 opened videos

// quality / generic tags say nothing about taste
const SKIP_TAGS = new Set(['hd', '4k', '2k', 'hq', 'pornstar', 'amateur', 'brunette', 'blonde'])

export const INDIAN_SHORTCUT = {
  kind: 'default',
  to: '/category/indian',
  label: 'Watch Indian movies',
  short: 'Indian',
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    if (raw && typeof raw === 'object') return { last: raw.last || null, tags: raw.tags || {} }
  } catch { /* storage blocked or corrupt: start fresh */ }
  return { last: null, tags: {} }
}

function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode / quota */ }
}

// Called when a movie page loads.
export function recordWatch(movie) {
  if (typeof window === 'undefined' || !movie?.slug || isBot()) return
  const state = read()
  const now = Date.now()
  const repeat = state.last?.slug === movie.slug && now - state.last.at < REOPEN_WINDOW
  state.last = { slug: movie.slug, title: movie.title, at: now }
  if (!repeat) {
    for (const name of (movie.tags || '').split(',').map((t) => t.trim()).filter(Boolean)) {
      if (SKIP_TAGS.has(name.toLowerCase())) continue
      const slug = slugify(name)
      if (!slug) continue
      const entry = state.tags[slug] || { name, n: 0 }
      entry.n += 1
      state.tags[slug] = entry
    }
    const slugs = Object.keys(state.tags)
    if (slugs.length > MAX_TAGS) {
      slugs.sort((a, b) => state.tags[b].n - state.tags[a].n)
      state.tags = Object.fromEntries(slugs.slice(0, MAX_TAGS).map((s) => [s, state.tags[s]]))
    }
  }
  write(state)
  try { window.dispatchEvent(new Event('vexn-watch')) } catch { /* old browsers */ }
}

// Up to three shortcuts, best first: continue the last video, the favourite
// category, then the Indian category (always there as the fallback).
export function getShortcuts() {
  const out = []
  if (typeof window !== 'undefined') {
    const { last, tags } = read()
    if (last && Date.now() - last.at < CONTINUE_MAX_AGE) {
      out.push({ kind: 'continue', to: `/movie/${last.slug}`, label: 'Continue watching', short: 'Continue', sub: last.title })
    }
    const fav = Object.entries(tags).sort((a, b) => b[1].n - a[1].n)[0]
    if (fav && fav[1].n >= MIN_FAVORITE) {
      out.push({ kind: 'favorite', to: `/category/${fav[0]}`, label: `More ${fav[1].name}`, short: fav[1].name })
    }
  }
  if (!out.some((s) => s.to === INDIAN_SHORTCUT.to)) out.push(INDIAN_SHORTCUT)
  return out.slice(0, 3)
}
