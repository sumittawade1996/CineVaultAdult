// node scripts/tag-report.mjs [out.csv]
// How the live catalogue's tags sit against the controlled category list in
// src/lib/categories.js (plan T22). Read-only.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { classifyTag, normalizeTags, CONTROLLED_CATEGORIES, CONTROLLED_BY_SLUG, TAG_ALIASES } from '../src/lib/categories.js'
import { checkContent } from '../src/lib/contentRules.js'
import { slugify } from '../src/lib/slugify.js'
import { MIN_INDEXABLE_TITLES } from '../src/lib/indexing.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('movies').select('slug,tags').order('slug').range(from, from + 999)
  if (error) throw error
  rows.push(...data)
  if (data.length < 1000) break
}

// tally by slug, remember the spellings used
const tally = new Map()
let rowsWithChanges = 0
for (const m of rows) {
  if (normalizeTags(m.tags).changes.length) rowsWithChanges++
  for (const raw of String(m.tags || '').split(',')) {
    const name = raw.trim()
    if (!name) continue
    const slug = slugify(name)
    const e = tally.get(slug) || { slug, names: new Map(), count: 0 }
    e.count++
    e.names.set(name, (e.names.get(name) || 0) + 1)
    tally.set(slug, e)
  }
}
const entries = [...tally.values()].map((e) => {
  const name = [...e.names.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const kind = classifyTag(name)
  const flags = []
  const hit = checkContent({ tags: name })
  if (hit.block.length) flags.push('blocked word')
  if (hit.review.length) flags.push('review word')
  if (e.names.size > 1) flags.push(`spellings: ${[...e.names.keys()].join(' / ')}`)
  if (kind === 'alias') flags.push(`use "${TAG_ALIASES.get(e.slug)}"`)
  if (kind === 'free' && e.count < 3) flags.push('1-2 titles: merge or drop')
  if (kind === 'free' && e.count >= MIN_INDEXABLE_TITLES.tags) flags.push('large enough to promote')
  return { name, slug: e.slug, count: e.count, kind, flags }
}).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

const by = (k) => entries.filter((e) => e.kind === k)
console.log(`${rows.length} movies, ${entries.length} distinct tags`)
console.log('\nControlled categories (40) by titles:')
for (const [group, names] of Object.entries(CONTROLLED_CATEGORIES)) {
  const line = names.map((n) => `${n} ${tally.get(slugify(n))?.count || 0}`).join(', ')
  console.log(`  ${group}: ${line}`)
}
const thin = [...CONTROLLED_BY_SLUG.keys()].filter((s) => (tally.get(s)?.count || 0) < MIN_INDEXABLE_TITLES.tags)
console.log(`\nControlled categories below ${MIN_INDEXABLE_TITLES.tags} titles (not indexable yet): ${thin.length ? thin.join(', ') : 'none'}`)
console.log(`Label tags (quality, source, format): ${by('label').length}; aliases still in use: ${by('alias').map((e) => `${e.name} (${e.count})`).join(', ') || 'none'}`)
console.log(`Free tags: ${by('free').length} (${by('free').filter((e) => e.count < 3).length} used on only 1-2 titles); promote candidates: ${by('free').filter((e) => e.count >= MIN_INDEXABLE_TITLES.tags).map((e) => `${e.name} (${e.count})`).join(', ') || 'none'}`)
console.log(`Movies whose tags the normaliser would change: ${rowsWithChanges}`)
const flagged = entries.filter((e) => e.flags.some((f) => /blocked|review/.test(f)))
if (flagged.length) console.log(`Tags with a content-rule word: ${flagged.map((e) => `${e.name} (${e.count})`).join(', ')}`)

const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const csv = ['tag,slug,titles,kind,notes', ...entries.map((e) => [e.name, e.slug, e.count, e.kind, e.flags.join('; ')].map(esc).join(','))].join('\n')
const out = process.argv[2] || 'tag-report.csv'
writeFileSync(out, '﻿' + csv)
console.log(`\nWrote ${out}`)
