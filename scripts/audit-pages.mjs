// node scripts/audit-pages.mjs [dist-dir] [--list]   (--list prints every offending page, not just two)
// Audits the prerendered pages in dist/ (run `npm run build` first) for the
// checks in plan T7/T14: every page type must carry a title, description,
// canonical, one H1 and the adult rating tag; movie pages also need a
// VideoObject + BreadcrumbList, a thumbnail with alt text, an embedded player
// and related links. Prints counts and the first few offenders. Read-only.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'dist'
const LIST = process.argv.includes('--list')

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (p.endsWith('.html')) yield p
  }
}

// HTML entities count as one character, as they do in a search result
const decode = (v) => (v == null ? v : v.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
const text = (html, re) => decode((html.match(re) || [])[1])
const count = (html, re) => (html.match(re) || []).length

const kinds = {
  movie: (rel) => rel.startsWith('movie/'),
  article: (rel) => rel.startsWith('article/'),
  category: (rel) => rel.startsWith('category/'),
  actor: (rel) => rel.startsWith('actor/'),
  channel: (rel) => rel.startsWith('channel/'),
  new: (rel) => rel === 'new.html' || rel.startsWith('new/'),
  other: () => true,
}
const kindOf = (rel) => Object.keys(kinds).find((k) => kinds[k](rel))

const results = {} // kind -> { pages, failures: { check -> [paths] } }
function fail(kind, check, rel) {
  const r = (results[kind] ||= { pages: 0, failures: {} })
  ;(r.failures[check] ||= []).push(rel)
}

for (const file of walk(DIST)) {
  const rel = file.slice(DIST.length + 1).replace(/\\/g, '/')
  if (rel === 'app.html') continue // the SPA shell, not a page
  const html = readFileSync(file, 'utf8')
  if (!html.includes('__VEXN_PRELOAD__')) continue
  const kind = kindOf(rel)
  const r = (results[kind] ||= { pages: 0, failures: {} })
  r.pages++

  const indexable = !/<meta[^>]*name="robots"[^>]*content="noindex/.test(html)
  const title = text(html, /<title[^>]*>([^<]*)<\/title>/)
  const description = text(html, /<meta[^>]*name="description"[^>]*content="([^"]*)"/)
  if (!title) fail(kind, 'title', rel)
  else if (indexable && title.length > 70) fail(kind, 'title longer than 70 characters', rel)
  if (!description) fail(kind, 'description', rel)
  else if (indexable && (description.length < 70 || description.length > 170)) fail(kind, 'description not 70–170 characters', rel)
  if (!/<link[^>]*rel="canonical"[^>]*href="https:\/\/vexn\.org\//.test(html)) fail(kind, 'canonical', rel)
  if (count(html, /<h1[ >]/g) !== 1) fail(kind, 'exactly one <h1>', rel)
  if (count(html, /<meta[^>]*name="rating"/g) !== 1) fail(kind, 'one rating meta', rel)
  if (!/<meta[^>]*name="robots"/.test(html)) fail(kind, 'robots meta', rel)

  if (kind === 'movie') {
    const ld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
    if (!ld.includes('"VideoObject"')) fail(kind, 'VideoObject JSON-LD', rel)
    if (!ld.includes('"BreadcrumbList"')) fail(kind, 'BreadcrumbList JSON-LD', rel)
    if (!/<nav class="breadcrumbs"/.test(html)) fail(kind, 'visible breadcrumb', rel)
    if (!/<img[^>]*class="[^"]*"?[^>]*alt="[^"]+ poster"/.test(html) && !/<img[^>]*alt="[^"]+ poster"/.test(html)) fail(kind, 'poster image with alt text', rel)
    if (!/<iframe[^>]*src="https?:\/\//.test(html)) fail(kind, 'embedded player', rel)
    if (!/<meta[^>]*property="og:image"/.test(html)) fail(kind, 'og:image', rel)
    if (!/You might also like/.test(html)) fail(kind, 'related videos block', rel)
    if (!/class="chip"[^>]*href="\/category\//.test(html) && !/href="\/category\/[^"]*"[^>]*class="chip"/.test(html)) fail(kind, 'category links', rel)
    const desc = text(html, /<p class="detail-desc">([^<]*)<\/p>/)
    if (!desc || desc.length < 200) fail(kind, 'on-page description of 200+ characters', rel)
  }
}

let problems = 0
for (const [kind, r] of Object.entries(results)) {
  const checks = Object.entries(r.failures)
  console.log(`${kind.padEnd(9)} ${String(r.pages).padStart(5)} pages  ${checks.length ? '' : 'all checks passed'}`)
  for (const [check, paths] of checks) {
    problems += paths.length
    console.log(`           ${String(paths.length).padStart(5)} fail: ${check}  ${LIST ? ':\n             ' + paths.join('\n             ') : 'e.g. ' + paths.slice(0, 2).join(', ')}`)
  }
}
console.log(problems ? `\n${problems} problems` : '\nno problems')
process.exit(problems ? 1 : 0)
