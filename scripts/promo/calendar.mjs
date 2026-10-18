// node scripts/promo/calendar.mjs [out.csv]
// Builds the post calendar from posts.mjs: final text (hook + hashtags + a UTM link), X length, and a check that
// every linked page exists. Read-only: nothing is scheduled or posted.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { POSTS } from './posts.mjs'
import { buildUtm, xLength } from './utm.mjs'
import { slugify } from '../../src/lib/slugify.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const movies = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('movies').select('slug,tags,actors,channel_slug').range(from, from + 999)
  if (error) throw error
  movies.push(...data)
  if (data.length < 1000) break
}
const { data: articles } = await supabase.from('articles').select('slug').eq('published', true)
const sets = {
  category: new Set(movies.flatMap((m) => (m.tags || '').split(',').map((t) => slugify(t.trim())))),
  actor: new Set(movies.flatMap((m) => (m.actors || '').split(',').map((t) => slugify(t.trim())))),
  channel: new Set(movies.map((m) => m.channel_slug).filter(Boolean)),
  article: new Set((articles || []).map((a) => a.slug)),
}
const exists = (path) => {
  const [, kind, slug] = path.match(/^\/(category|actor|channel|article)\/([^/]+)$/) || []
  return kind ? sets[kind].has(slug) : ['/new', '/movies', '/'].includes(path)
}

const CAMPAIGN = 'evergreen-2026-11'
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
let problems = 0
const rows = POSTS.map((p, i) => {
  const url = buildUtm(p.path, { source: 'x', campaign: CAMPAIGN, content: `p${String(i + 1).padStart(2, '0')}` })
  const text = `${p.text} ${p.tags.map((t) => `#${t}`).join(' ')}\n\n${url}`
  const len = xLength(text)
  const ok = exists(p.path)
  if (!ok || len > 280) { problems++; console.log(`PROBLEM ${p.date}: ${!ok ? `page ${p.path} does not exist` : `length ${len}`}`) }
  const day = new Date(`${p.date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
  return { date: p.date, day, time: p.time, path: p.path, len, text, ok }
})
const csv = ['date_ist,day,time_ist,page,x_length,post_text,page_exists', ...rows.map((r) => [r.date, r.day, r.time, r.path, r.len, r.text, r.ok ? 'yes' : 'NO'].map(esc).join(','))].join('\n')
const out = process.argv[2] || 'promo-calendar.csv'
writeFileSync(out, '﻿' + csv)
console.log(`${rows.length} posts from ${rows[0].date} to ${rows.at(-1).date}, ${problems} problem(s). Wrote ${out}`)
process.exit(problems ? 1 : 0)
