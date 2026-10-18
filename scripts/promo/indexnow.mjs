// node scripts/promo/indexnow.mjs                      list what would be sent (dry run)
// node scripts/promo/indexnow.mjs --since=2026-10-18   only URLs whose sitemap lastmod is on or after that day
// node scripts/promo/indexnow.mjs --send               send to the IndexNow API (Bing and the engines that share it)
//
// IndexNow (plan section 9, item 5) tells participating search engines about new and changed URLs right away.
// The key is public by design: the engine checks that https://vexn.org/<key>.txt contains it.
// Run after a deploy, so the URLs it lists exist. Default is a dry run; nothing is sent without --send.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const HOST = 'vexn.org'
const ENDPOINT = 'https://api.indexnow.org/indexnow'

export function findKey(dir = 'public') {
  const file = readdirSync(dir).find((f) => /^[a-f0-9]{32}\.txt$/.test(f))
  if (!file) throw new Error(`no IndexNow key file in ${dir}/ (expected <32 hex characters>.txt)`)
  const key = readFileSync(`${dir}/${file}`, 'utf8').trim()
  if (`${key}.txt` !== file) throw new Error(`${file} must contain its own name as the key`)
  return key
}

// [{ loc, lastmod }] from the sitemap files in a folder (the index is skipped)
export function readSitemaps(dir = 'public') {
  const out = []
  for (const f of readdirSync(dir).filter((n) => /^sitemap-.*\.xml$/.test(n))) {
    const xml = readFileSync(`${dir}/${f}`, 'utf8')
    for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) || []) {
      const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]
      const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] || null
      if (loc) out.push({ loc: loc.replace(/&amp;/g, '&'), lastmod })
    }
  }
  return out
}

// URLs to submit: same host only, optionally only those modified on or after `since` (YYYY-MM-DD)
export function pickUrls(entries, { since = null } = {}) {
  const seen = new Set()
  const urls = []
  for (const e of entries) {
    let u
    try { u = new URL(e.loc) } catch { continue }
    if (u.hostname !== HOST || seen.has(u.href)) continue
    if (since && e.lastmod && e.lastmod.slice(0, 10) < since) continue
    seen.add(u.href)
    urls.push(u.href)
  }
  return urls
}

async function main() {
  const args = process.argv.slice(2)
  const send = args.includes('--send')
  const since = args.find((a) => a.startsWith('--since='))?.slice(8) || null
  const key = findKey()
  const urls = pickUrls(readSitemaps(), { since })
  console.log(`${urls.length} URL(s)${since ? ` modified since ${since}` : ''}; key ${key.slice(0, 6)}…; ${send ? 'SENDING' : 'dry run (add --send to submit)'}`)
  for (const u of urls.slice(0, 5)) console.log('  ', u)
  if (urls.length > 5) console.log(`   … and ${urls.length - 5} more`)
  if (!send || urls.length === 0) return
  for (let i = 0; i < urls.length; i += 10000) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls.slice(i, i + 10000) }),
    })
    console.log(`batch ${i / 10000 + 1}: HTTP ${res.status}${res.status === 200 || res.status === 202 ? ' (accepted)' : ' (check the key file is live and the URLs exist)'}`)
  }
}

if (existsSync('public') && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1) })
