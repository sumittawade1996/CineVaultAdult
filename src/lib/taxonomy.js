import { slugify } from './slugify'

// Turns a list of movies + a comma-separated field name (e.g. "actors" or "tags")
// into a sorted, deduped list of { name, slug, count }.
export function buildTaxonomy(movies, field) {
  const map = new Map()
  for (const movie of movies) {
    const raw = movie[field]
    if (!raw) continue
    for (const name of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      const slug = slugify(name)
      const entry = map.get(slug) || { name, slug, count: 0 }
      entry.count += 1
      map.set(slug, entry)
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// Single-value taxonomy (e.g. "channel", which is one value per movie, not comma-separated)
export function buildSingleTaxonomy(movies, field) {
  const map = new Map()
  for (const movie of movies) {
    const raw = movie[field]
    if (!raw) continue
    const name = raw.trim()
    const slug = slugify(name)
    const entry = map.get(slug) || { name, slug, count: 0 }
    entry.count += 1
    map.set(slug, entry)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
