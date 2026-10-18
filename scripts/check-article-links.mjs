// node scripts/check-article-links.mjs [--slug=some-article]
// Checks every internal link and a few quality rules in the published articles (plan section 7):
//   - /movie, /actor, /category, /channel and /article links must point at something that exists
//   - words: counts per article, so thin ones are visible
//   - statistics that cannot be sourced ("45% growth", "million views") are listed for review
// Read-only. Exit code 1 when a link is dead.
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { slugify } from '../src/lib/slugify.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const only = process.argv.find((a) => a.startsWith('--slug='))?.slice(7)
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function all(table, select) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const movies = await all('movies', 'slug,tags,actors,channel_slug')
const articles = await all('articles', 'slug,title,content,published,author,seo_description,excerpt')
const movieSlugs = new Set(movies.map((m) => m.slug))
const tagSlugs = new Set(movies.flatMap((m) => (m.tags || '').split(',').map((t) => slugify(t.trim())).filter(Boolean)))
const actorSlugs = new Set(movies.flatMap((m) => (m.actors || '').split(',').map((t) => slugify(t.trim())).filter(Boolean)))
const channelSlugs = new Set(movies.map((m) => m.channel_slug).filter(Boolean))
const articleSlugs = new Set(articles.filter((a) => a.published).map((a) => a.slug))

const STAT = /\b\d[\d,.]*\s?(?:%|percent)|\b(?:million|billion)\b|year-over-year|\byoy\b|\bseveral hundred thousand\b|\b\d{3},\d{3}\b/gi
let dead = 0
const rows = []
for (const a of articles.filter((x) => x.published && (!only || x.slug === only))) {
  const html = a.content || ''
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
  const words = (text.match(/\S+/g) || []).length
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  const internal = links.filter((h) => h.startsWith('/'))
  const bad = []
  for (const h of internal) {
    const path = h.split('#')[0].split('?')[0]
    const [, kind, slug] = path.match(/^\/(movie|actor|category|channel|article)\/([^/]+)$/) || []
    const ok =
      kind === 'movie' ? movieSlugs.has(slug)
      : kind === 'actor' ? actorSlugs.has(slug)
      : kind === 'category' ? tagSlugs.has(slug)
      : kind === 'channel' ? channelSlugs.has(slug)
      : kind === 'article' ? articleSlugs.has(slug)
      : ['/', '/movies', '/actors', '/categories', '/channels', '/articles', '/new', '/partners', '/legal/dmca', '/legal/terms', '/legal/privacy', '/legal/2257'].includes(path)
    if (!ok) bad.push(h)
  }
  dead += bad.length
  const stats = [...new Set((text.match(STAT) || []).map((s) => s.trim()))]
  rows.push({ slug: a.slug, words, internal: internal.length, bad, stats, descLen: (a.seo_description || '').length, author: a.author })
}
rows.sort((a, b) => a.words - b.words)
for (const r of rows) {
  console.log(`${String(r.words).padStart(5)} words  ${String(r.internal).padStart(2)} links  desc ${String(r.descLen).padStart(3)}  ${r.slug}${r.bad.length ? `\n         DEAD: ${r.bad.join(', ')}` : ''}${r.stats.length ? `\n         check numbers: ${r.stats.join(' | ')}` : ''}`)
}
console.log(`\n${rows.length} published articles, ${rows.filter((r) => r.words < 900).length} under 900 words, ${dead} dead internal link(s)`)
process.exit(dead ? 1 : 0)
