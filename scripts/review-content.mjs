// node scripts/review-content.mjs [out.csv]
// Lists the catalogue rows that match the content rules in src/lib/contentRules.js
// (plan T17). Read-only: it never changes or deletes anything. The CSV is for a
// person to decide row by row.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { checkContent } from '../src/lib/contentRules.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('movies')
    .select('slug, title, tags, keywords, description, channel, featured')
    .order('title')
    .range(from, from + 999)
  if (error) throw error
  rows.push(...data)
  if (data.length < 1000) break
}

const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const hits = rows
  .map((m) => ({ m, h: checkContent(m) }))
  .filter(({ h }) => h.block.length || h.review.length)
  .sort((a, b) => (b.h.block.length > 0) - (a.h.block.length > 0) || (b.m.featured - a.m.featured) || a.m.title.localeCompare(b.m.title))

const csv = [
  'priority,featured,slug,title,channel,blocked_for,review_for,url',
  ...hits.map(({ m, h }) =>
    [
      h.block.length ? 'BLOCKED THEME' : 'review',
      m.featured ? 'yes' : '',
      m.slug,
      m.title,
      m.channel || '',
      h.block.map((x) => `${x.label} ("${x.match}")`).join('; '),
      h.review.map((x) => `${x.label} ("${x.match}")`).join('; '),
      `https://vexn.org/movie/${m.slug}`,
    ].map(esc).join(',')
  ),
].join('\n')
const out = process.argv[2] || 'content-review.csv'
writeFileSync(out, '\ufeff' + csv)
const blocked = hits.filter(({ h }) => h.block.length)
console.log(`${rows.length} movies checked: ${blocked.length} match a blocked theme (${blocked.filter(({ m }) => m.featured).length} featured), ${hits.length - blocked.length} to review. Wrote ${out}`)
