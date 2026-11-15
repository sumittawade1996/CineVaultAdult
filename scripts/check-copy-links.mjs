// npm run check:copy
// Checks every link in the hand-written copy against the live catalogue: channel intros, performer bios, category
// intros (scripts/data/) and the built-in intros of the home page and the three lists (src/lib/pageCopy.js). A link must
// point at a page that exists and is indexed (src/lib/indexing.js): a performer with 5+ videos, a category with 10+
// that is not a label tag, a studio channel with 3+. Read-only (public key); exits 1 when a link fails.
import { existsSync, readFileSync } from 'node:fs'
import { CHANNEL_INTROS } from './data/channel-intros.mjs'
import { PERFORMER_BIOS } from './data/performer-bios.mjs'
import { CATEGORIES } from './data/category-descriptions.mjs'
import { PAGE_COPY_DEFAULTS } from '../src/lib/pageCopy.js'
import { introLinkPaths } from '../src/lib/introLinks.js'
import { isIndexableTaxonomy } from '../src/lib/indexing.js'

const env = { ...process.env }
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '') }

const rows = []
for (let from = 0; ; from += 1000) {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/movies?select=actors_slugs,tags_slugs,channel_slug&order=id&offset=${from}&limit=1000`, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY } })
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error(`database read failed: ${JSON.stringify(data).slice(0, 120)}`)
  rows.push(...data)
  if (data.length < 1000) break
}
const count = { actors: new Map(), tags: new Map(), channel: new Map() }
const bump = (map, key) => key && map.set(key, (map.get(key) || 0) + 1)
for (const r of rows) {
  for (const a of r.actors_slugs || []) bump(count.actors, a)
  for (const t of r.tags_slugs || []) bump(count.tags, t)
  bump(count.channel, r.channel_slug)
}
const notIndexed = new Set(CATEGORIES.filter((c) => c.is_indexable === false).map((c) => c.slug))

const FIELD = { actor: 'actors', category: 'tags', channel: 'channel' }
function linkProblem(path) {
  const [, kind, slug] = path.split('/')
  if (!slug) return null // a list page (/channels, /new, ...)
  const field = FIELD[kind]
  if (!field) return null // a movie or article page: not checked here
  const n = count[field].get(slug) || 0
  if (!n) return 'no videos'
  if (!isIndexableTaxonomy(field, slug, n) || (field === 'tags' && notIndexed.has(slug))) return `not indexed (${n} videos)`
  return null
}

const sources = [
  ...Object.entries(CHANNEL_INTROS).map(([slug, text]) => [`channel ${slug}`, text]),
  ...Object.entries(PERFORMER_BIOS).map(([slug, text]) => [`performer ${slug}`, text]),
  ...CATEGORIES.map((c) => [`category ${c.slug}`, c.intro]),
  ...Object.entries(PAGE_COPY_DEFAULTS).map(([slug, c]) => [`page ${slug}`, c.intro]),
]
let links = 0
const failures = []
for (const [where, text] of sources) {
  for (const path of introLinkPaths(text)) {
    links++
    const problem = linkProblem(path)
    if (problem) failures.push(`${where}: ${path} – ${problem}`)
  }
}
console.log(`${rows.length} videos read; ${links} links in ${sources.length} texts`)
if (failures.length) {
  console.log(failures.join('\n'))
  process.exit(1)
}
console.log('every link points at an indexed page')
