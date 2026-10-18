// "You might also like" on a movie page (plan T13): videos with the same
// performer first, then videos that share topic tags, then the same channel.
// A movie with nothing in common still gets the newest videos, so no movie
// page is a dead end.
//
// The same code runs in the browser (candidates come from a Supabase query
// built from relatedKeys) and in scripts/prerender.mjs (candidates come from
// the rows already in memory), so the prerendered list and the refreshed list
// are identical.

import { slugify } from './slugify.js'
import { ATTRIBUTE_TAGS, CATCH_ALL_CHANNELS } from './indexing.js'

// Newest first; equal timestamps (bulk imports) fall back to id, the same
// order the database queries use, so both sides pick the same rows.
const byDate = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(a.id).localeCompare(String(b.id))

export const RELATED_COUNT = 4
export const CANDIDATE_LIMIT = 80

const slugs = (text) => [...new Set((text || '').split(',').map((s) => s.trim()).filter(Boolean).map(slugify))]

// What a movie can be related through. Attribute tags (hd, 4k, pornstar, ...)
// say nothing about topic, and the catch-all "VEXN" channel holds most of the
// catalogue, so sharing it says nothing either.
export function relatedKeys(movie) {
  const channel = slugify(movie?.channel || '')
  return {
    actors: slugs(movie?.actors),
    tags: slugs(movie?.tags).filter((t) => !ATTRIBUTE_TAGS.has(t)),
    channel: channel && !CATCH_ALL_CHANNELS.has(channel) ? channel : null,
  }
}

// Higher = more related. A shared performer outweighs several shared tags.
export function relatedScore(keys, other) {
  const otherActors = new Set(slugs(other.actors))
  const otherTags = new Set(slugs(other.tags))
  let score = 0
  for (const a of keys.actors) if (otherActors.has(a)) score += 10
  for (const t of keys.tags) if (otherTags.has(t)) score += 2
  if (keys.channel && slugify(other.channel || '') === keys.channel) score += 1
  return score
}

// Does this row share anything with the keys? Used to pick candidates.
export const sharesKeys = (keys, other) => relatedScore(keys, other) > 0

// movie + candidate rows -> up to `count` rows, best first (ties: newest)
export function pickRelated(movie, candidates, count = RELATED_COUNT) {
  const keys = relatedKeys(movie)
  const others = candidates.filter((c) => c.id !== movie.id)
    const scored = others
    .map((row) => ({ row, score: relatedScore(keys, row) }))
    .sort((a, b) => b.score - a.score || byDate(a.row, b.row))
  const picked = scored.filter((s) => s.score > 0).slice(0, count).map((s) => s.row)
  if (picked.length < count) {
    const have = new Set(picked.map((r) => r.id))
    for (const row of [...others].sort(byDate)) {
      if (picked.length >= count) break
      if (!have.has(row.id)) picked.push(row)
    }
  }
  return picked
}

// Which rows to fetch as candidates: those sharing a performer (newest 40),
// those sharing a topic tag (newest 60), and always the newest 8 as filler.
// Capping each set keeps the query small; asking for the performers
// separately means a performer match is never crowded out by popular tags.
export function candidateSpecs(movie) {
  const keys = relatedKeys(movie)
  const specs = []
  if (keys.actors.length) specs.push({ column: 'actors_slugs', values: keys.actors, limit: 40 })
  if (keys.tags.length) specs.push({ column: 'tags_slugs', values: keys.tags, limit: 60 })
  specs.push({ column: null, values: [], limit: 8 })
  return specs
}

// The same selection done in memory (the build script has every row at hand).
export function selectCandidates(movie, rows) {
  const newestFirst = [...rows].sort(byDate)
  const picked = new Map()
  for (const spec of candidateSpecs(movie)) {
    const field = spec.column === 'actors_slugs' ? 'actors' : 'tags'
    const wanted = new Set(spec.values)
    let taken = 0
    for (const row of newestFirst) {
      if (taken >= spec.limit) break
      if (row.id === movie.id) continue
      if (spec.column && !slugs(row[field]).some((v) => wanted.has(v))) continue
      picked.set(row.id, row)
      taken++
    }
  }
  return [...picked.values()]
}
