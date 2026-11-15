// Which pages a deploy should announce to IndexNow: the sitemap that was live before the build against the one the build
// wrote. New pages, pages whose lastmod moved, and pages that left the sitemap (a removed video, a page that is no longer
// indexed) are sent; nothing else. Pure functions, tested offline (scripts/test-indexnow-diff.mjs); used by the Netlify
// build plugin netlify/plugins/indexnow.
export const MAX_PER_REQUEST = 10000 // the IndexNow limit for one POST

const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")

// <urlset> -> Map(loc -> lastmod or null)
export function parseSitemap(xml) {
  const out = new Map()
  for (const block of String(xml || '').match(/<url>[\s\S]*?<\/url>/g) || []) {
    const loc = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1]
    if (!loc) continue
    out.set(unescape(loc), block.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1] || null)
  }
  return out
}

// <sitemapindex> -> the child sitemap addresses
export function parseSitemapIndex(xml) {
  const part = String(xml || '').includes('<sitemapindex') ? String(xml) : ''
  return [...part.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/sitemap>/g)].map((m) => unescape(m[1]))
}

// before, after: Map(loc -> lastmod). A lastmod compared by its day, so a time-of-day change alone does not count.
export function diffSitemaps(before, after) {
  const day = (v) => (v ? String(v).slice(0, 10) : null)
  const added = []
  const changed = []
  const removed = []
  for (const [loc, lastmod] of after) {
    if (!before.has(loc)) added.push(loc)
    else if (day(before.get(loc)) !== day(lastmod)) changed.push(loc)
  }
  for (const loc of before.keys()) if (!after.has(loc)) removed.push(loc)
  return { added, changed, removed }
}

// The list to send: this host only, each address once, new pages first, at most one request's worth
export function urlsToSend({ added = [], changed = [], removed = [] }, host, max = MAX_PER_REQUEST) {
  const seen = new Set()
  const out = []
  for (const u of [...added, ...changed, ...removed]) {
    let url
    try { url = new URL(u) } catch { continue }
    if (url.hostname !== host || seen.has(url.href)) continue
    seen.add(url.href)
    out.push(url.href)
    if (out.length >= max) break
  }
  return out
}
