// Rewrites boilerplate and pitch wording in each movie's on-page description, search description
// and search title (plan 14.7), using only what the row itself states (see scripts/lib/movieCopy.mjs).
//
//   node scripts/rewrite-movie-copy.mjs               dry run: prints the counts and samples, writes the
//                                                      before/after CSV, changes nothing
//   node scripts/rewrite-movie-copy.mjs --apply       saves the old text to a backup file, then updates the rows
//                                                      (needs SUPABASE_SERVICE_ROLE_KEY in .env since migration 004)
//   node scripts/rewrite-movie-copy.mjs --sample=20   number of before/after samples to print (default 10)
//
// Rows that the content rules block (non-consent, youth, step-family ...) are left alone: their
// wording is decided together with the row. A field that is already clean is not touched.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { checkContent } from '../src/lib/contentRules.js'
import { CLAIMS, isClean, rewriteCopy } from './lib/movieCopy.mjs'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const SAMPLES = Number(args.find((a) => a.startsWith('--sample='))?.split('=')[1] ?? 10)
const FIELDS = ['description', 'seo_description', 'seo_title']
const day = new Date().toISOString().slice(0, 10)
const downloads = join(homedir(), 'Downloads')

const env = { ...process.env }
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const SB_URL = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
if (!SB_URL || !KEY) { console.error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are needed (.env)'); process.exit(1) }
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const rows = []
for (let from = 0; ; from += 500) {
  const res = await fetch(`${SB_URL}/rest/v1/movies?select=id,slug,title,description,seo_title,seo_description,tags,actors,runtime_minutes,channel,source,keywords&order=slug&offset=${from}&limit=500`, { headers })
  const data = await res.json()
  if (!Array.isArray(data)) { console.error('read failed', JSON.stringify(data).slice(0, 200)); process.exit(1) }
  rows.push(...data)
  if (data.length < 500) break
}

// ---- plan ----------------------------------------------------------------------------------
const plan = [] // { slug, changes: { field: { old, new, mode } } }
const held = []
const problems = []
const modes = Object.fromEntries(FIELDS.map((f) => [f, { keep: 0, strip: 0, hybrid: 0, draft: 0 }]))
// search descriptions that stay as they are (kept or held rows) are taken before any new one is chosen
const used = new Set()
for (const row of rows) {
  const s = row.seo_description || ''
  if (checkContent(row).block.length || (s.length >= 140 && s.length <= 160 && isClean(s))) used.add(s.toLowerCase())
}
for (const row of rows) {
  const hits = checkContent(row)
  if (hits.block.length) { held.push(row.slug); continue }
  const next = rewriteCopy(row, used)
  if (next.mode.seo_description !== 'keep') used.add(next.seo_description.toLowerCase())
  const changes = {}
  for (const f of FIELDS) {
    modes[f][next.mode[f]]++
    if (next.mode[f] !== 'keep' && next[f] !== (row[f] || '')) changes[f] = { old: row[f] || '', new: next[f], mode: next.mode[f] }
  }
  if (Object.keys(changes).length) plan.push({ slug: row.slug, row, changes })
}

// ---- checks on the new text -----------------------------------------------------------------
const LIMITS = { description: [200, 450], seo_description: [140, 160], seo_title: [30, 53] }
const seen = { seo_description: new Map(), seo_title: new Map(), description: new Map() }
const rowByslug = new Map(rows.map((r) => [r.slug, r]))
const finalValue = (slug, f) => plan.find((p) => p.slug === slug)?.changes[f]?.new ?? rowByslug.get(slug)[f]
for (const r of rows) for (const f of FIELDS) {
  const v = finalValue(r.slug, f)
  if (!v) continue
  const key = v.toLowerCase()
  seen[f].set(key, [...(seen[f].get(key) || []), r.slug])
}
for (const p of plan) {
  for (const [f, c] of Object.entries(p.changes)) {
    const [min, max] = LIMITS[f]
    if (c.new.length < min || c.new.length > max) problems.push(`${p.slug} ${f}: ${c.new.length} characters`)
    if (f !== 'seo_title' && !isClean(c.new)) problems.push(`${p.slug} ${f}: still has wording the site cannot back (${c.new.match(CLAIMS)?.[0] ?? 'blocked wording'})`)
    if (/\bnull\b|undefined|NaN/.test(c.new)) problems.push(`${p.slug} ${f}: empty value in text`)
    if (checkContent({ [f === 'seo_title' ? 'title' : 'description']: c.new }).block.length) problems.push(`${p.slug} ${f}: blocked wording`)
    if (seen[f].get(c.new.toLowerCase()).length > 1) problems.push(`${p.slug} ${f}: same text as ${seen[f].get(c.new.toLowerCase()).filter((s) => s !== p.slug).join(', ')}`)
  }
}

// ---- report ---------------------------------------------------------------------------------
console.log(`${rows.length} movies; ${held.length} held (blocked theme, not touched); ${plan.length} to change`)
for (const f of FIELDS) {
  const m = modes[f]
  console.log(`  ${f.padEnd(16)} kept ${m.keep} | cleaned ${m.strip} | rebuilt from old text ${m.hybrid} | drafted ${m.draft}`)
}
console.log(`${problems.length} problems${problems.length ? ':' : ''}`)
problems.slice(0, 25).forEach((p) => console.log('  - ' + p))

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const csv = ['slug,field,mode,old,new', ...plan.flatMap((p) => Object.entries(p.changes).map(([f, c]) => [p.slug, f, c.mode, c.old, c.new].map(csvCell).join(',')))]
// one file per run (date and time), so a later dry run never overwrites the list of an applied run
const csvPath = join(downloads, `vexn_copy_rewrite_${day}_${new Date().toISOString().slice(11, 16).replace(':', '')}.csv`)
writeFileSync(csvPath, csv.join('\n'))
console.log(`before/after list: ${csvPath}`)

// --mode=draft (or hybrid, strip) limits the samples to rows whose description was built that way
const onlyMode = args.find((a) => a.startsWith('--mode='))?.split('=')[1]
const sampled = onlyMode ? plan.filter((p) => p.changes.description?.mode === onlyMode) : plan
const stride = Math.max(1, Math.floor(sampled.length / Math.max(1, SAMPLES)))
for (const p of sampled.filter((_, i) => i % stride === 0).slice(0, SAMPLES)) {
  console.log(`\n# ${p.slug}  [${p.row.channel || '-'} | ${p.row.source || '-'}]`)
  for (const [f, c] of Object.entries(p.changes)) console.log(` ${f} (${c.mode}, ${c.old.length} -> ${c.new.length})\n   old: ${c.old}\n   new: ${c.new}`)
}

if (!APPLY) { console.log('\nDry run: nothing was changed. Run again with --apply to update the rows.'); process.exit(problems.length ? 2 : 0) }
if (problems.length) { console.error('\nNot applying: fix the problems above first.'); process.exit(2) }
// The public key can no longer write to movies (migration 004), so writing needs the service role key,
// kept only in your local .env (never committed): SUPABASE_SERVICE_ROLE_KEY=...
const WRITE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!WRITE_KEY) {
  console.error('\n--apply needs SUPABASE_SERVICE_ROLE_KEY in .env (the public key cannot write to movies any more).')
  console.error('The before/after list was written, so the same changes can also be run through the Supabase SQL editor.')
  process.exit(2)
}
const writeHeaders = { apikey: WRITE_KEY, Authorization: `Bearer ${WRITE_KEY}` }

// ---- apply ----------------------------------------------------------------------------------
const backupPath = join(downloads, `vexn_copy_backup_${day}_step21.json`)
writeFileSync(backupPath, JSON.stringify(plan.map((p) => ({ slug: p.slug, ...Object.fromEntries(Object.entries(p.changes).map(([f, c]) => [f, c.old])) })), null, 1))
console.log(`\nold text saved: ${backupPath}`)

let done = 0
let failed = []
async function patch(p) {
  const body = Object.fromEntries(Object.entries(p.changes).map(([f, c]) => [f, c.new]))
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(`${SB_URL}/rest/v1/movies?slug=eq.${encodeURIComponent(p.slug)}`, {
      method: 'PATCH',
      headers: { ...writeHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    })
    if (res.ok) { done++; return }
    if (attempt === 2) failed.push(`${p.slug}: ${res.status}`)
  }
}
const queue = [...plan]
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await patch(queue.shift()) }))
console.log(`updated ${done} of ${plan.length} rows${failed.length ? `; failed: ${failed.join(', ')}` : ''}`)
process.exit(failed.length ? 1 : 0)
