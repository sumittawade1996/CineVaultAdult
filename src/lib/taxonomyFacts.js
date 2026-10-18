// "At a glance" numbers for performer and channel pages (plan 6.3, item 4).
// Everything is counted from the list of videos the page already has, so the
// prerendered HTML and the browser agree and no number is written by hand.
import { slugify } from './slugify.js'

const MIN_TITLES = 3 // below this the block would only repeat the grid

function tally(values) {
  const map = new Map()
  for (const v of values) if (v) map.set(v, (map.get(v) || 0) + 1)
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }))
}

// matches: video rows with runtime_minutes, channel, source, actors, slug, title
// ownSlug: the performer's slug on an actor page, so they are not listed as their own co-star
export function summarizeMatches(matches, { ownSlug = null } = {}) {
  if (!Array.isArray(matches) || matches.length < MIN_TITLES) return null
  const known = matches.filter((m) => Number.isFinite(m.runtime_minutes) && m.runtime_minutes > 0)
  const runtime = known.length
    ? {
        known: known.length,
        min: Math.min(...known.map((m) => m.runtime_minutes)),
        max: Math.max(...known.map((m) => m.runtime_minutes)),
        avg: Math.round(known.reduce((s, m) => s + m.runtime_minutes, 0) / known.length),
        over30: known.filter((m) => m.runtime_minutes >= 30).length,
      }
    : null
  const channels = tally(matches.map((m) => m.channel))
  const sources = tally(matches.map((m) => m.source))

  const people = new Map() // slug -> { name, count }
  for (const m of matches) {
    for (const raw of String(m.actors || '').split(',')) {
      const name = raw.trim()
      const slug = slugify(name)
      if (!slug || slug === ownSlug) continue
      const e = people.get(slug) || { name, slug, count: 0 }
      e.count++
      people.set(slug, e)
    }
  }
  const coStars = [...people.values()].filter((p) => p.count >= 2).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5)

  const longest = [...known]
    .sort((a, b) => b.runtime_minutes - a.runtime_minutes || a.slug.localeCompare(b.slug))
    .slice(0, 3)
    .map((m) => ({ slug: m.slug, title: m.title, minutes: m.runtime_minutes }))

  return { count: matches.length, runtime, channels, sources, coStars, longest }
}

const MIN_RAIL_TITLES = 4 // fewer than this and the side picks would repeat the whole grid

// Videos for the desktop side rail ("Watch next"): the ones flagged featured first, then the
// longest, and only rows that have a poster. posterOf(movie) says whether a row has one.
export function pickRail(matches, count, posterOf = (m) => m.poster_url) {
  if (!Array.isArray(matches) || matches.length < MIN_RAIL_TITLES || !(count > 0)) return []
  const withPoster = matches.filter((m) => posterOf(m))
  const byLength = (a, b) => (b.runtime_minutes || 0) - (a.runtime_minutes || 0) || a.slug.localeCompare(b.slug)
  const featured = withPoster.filter((m) => m.featured).sort(byLength)
  const rest = withPoster.filter((m) => !m.featured).sort(byLength)
  return [...featured, ...rest].slice(0, count)
}
