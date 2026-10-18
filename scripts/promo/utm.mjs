// UTM links for posts on X and Telegram (plan section 9, item 1).
//   node scripts/promo/utm.mjs /category/indian x social evergreen-2026-11 wk1-sat
// The site keeps these parameters out of the canonical URL (src/lib/seoUrl.js)
// and records them in page_views (src/lib/analytics.js), so tagged links are safe to post.
import { pathToFileURL } from 'node:url'

export const SITE = 'https://vexn.org'

// utm_campaign: "<theme>-<yyyy>-<mm>"; utm_content: free text such as the slot ("wk1-sat")
export function buildUtm(pathOrUrl, { source, medium = 'social', campaign, content } = {}) {
  if (!source || !campaign) throw new Error('source and campaign are required')
  const url = new URL(pathOrUrl, SITE)
  if (url.origin !== SITE) throw new Error(`only ${SITE} links are tagged`)
  for (const [k, v] of Object.entries({ utm_source: source, utm_medium: medium, utm_campaign: campaign, utm_content: content })) {
    if (v) url.searchParams.set(k, String(v).toLowerCase().replace(/[^a-z0-9_-]+/g, '-'))
  }
  return url.toString()
}

// How X counts a post: every link is 23 characters, CJK characters and emoji count double.
export function xLength(text) {
  const withoutLinks = String(text).replace(/https?:\/\/\S+/g, '\u0000'.repeat(23))
  let n = 0
  for (const ch of withoutLinks) {
    const c = ch.codePointAt(0)
    const wide = (c >= 0x1100 && c <= 0x11ff) || (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xac00 && c <= 0xd7af) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x1f300 && c <= 0x1faff) || c >= 0x20000
    n += wide ? 2 : 1
  }
  return n
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [path, source, medium, campaign, content] = process.argv.slice(2)
  if (!path || !source || !campaign) {
    console.log('usage: node scripts/promo/utm.mjs <path> <source> <medium> <campaign> [content]')
    process.exit(1)
  }
  console.log(buildUtm(path, { source, medium, campaign, content }))
}
