// Partner links (plan T15): the footer list and the /partners page. Rows come
// from public.footer_partners; this turns them into safe link props. No React
// or Supabase here, so the build script (scripts/prerender.mjs) and the tests
// can import it too.

export const PARTNER_COLUMNS = 'name,label,url,rel,open_in_new_tab,description,details'

// rel tokens a partner row may set. Anything else is dropped.
const REL_TOKENS = new Set(['sponsored', 'nofollow', 'ugc', 'noopener', 'noreferrer'])

export function safeRel(rel, newTab) {
  const tokens = new Set(
    String(rel || '')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => REL_TOKENS.has(t))
  )
  if (!tokens.has('sponsored') && !tokens.has('nofollow')) tokens.add('sponsored') // a paid link is always marked
  if (newTab) tokens.add('noopener')
  return [...tokens].join(' ')
}

// "VEXN India" -> "vexn-india": the anchor for /partners#vexn-india
export function partnerAnchor(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Blank line = new paragraph. Text only; React escapes it when rendered.
function paragraphs(value) {
  return String(value || '')
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

// rows -> [{ key, id, name, href, host, text, rel, target, title, description,
// details }]; unusable rows are skipped. `text` is the footer link text (the
// label, or the name), `details` is a list of paragraphs.
export function normalizePartners(rows) {
  const out = []
  const used = new Set()
  for (const row of Array.isArray(rows) ? rows : []) {
    let url
    try {
      url = new URL(row?.url)
    } catch {
      continue
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue
    const name = String(row.name || row.label || '').trim()
    const text = String(row.label || row.name || '').trim()
    if (!text) continue
    const newTab = row.open_in_new_tab !== false
    const host = url.hostname.replace(/^www\./, '')
    // Anchor ids must be unique on the page even when two partners share a name.
    const base = partnerAnchor(name) || partnerAnchor(host) || 'partner'
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    out.push({
      key: url.href,
      id,
      name,
      href: url.href,
      host,
      text,
      rel: safeRel(row.rel, newTab),
      target: newTab ? '_blank' : undefined,
      title: row.description || undefined,
      description: String(row.description || '').trim(),
      details: paragraphs(row.details),
    })
  }
  return out
}
