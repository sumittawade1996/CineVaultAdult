// Checks the link card of every movie on the live site the way X's crawler sees it, and warms the image cache.
//
//   node scripts/check-cards.mjs                 every movie in the live sitemap
//   node scripts/check-cards.mjs --base=https://vexn.org --conc=3 --limit=40    (--limit: only the first 40 pages, for a quick try)
//
// For each movie page it asks as Twitterbot, reads the card tags and fetches the card image once. The first fetch of
// an image can take 4-13 s (Eporner's image server is slow on a cold image); the /og-img/ route then caches it for a
// year, so running this after a deploy or an import means X's crawler always gets a fast answer. A video that Eporner
// removed has no image on any frame: it is listed as "image 404" and the page is a candidate for the removed-videos list
// (npm run check-embeds). Read-only; exits 1 when a card has a problem.
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const BASE = String(args.base || 'https://vexn.org').replace(/\/$/, '')
const CONC = Number(args.conc || 3) // more than a few at once makes Eporner's image server (and our requests) time out
const UA = 'Twitterbot/1.0'
const SLOW_MS = 4000

const sitemap = await (await fetch(`${BASE}/sitemap-movies.xml`)).text()
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, Number(args.limit) || undefined)
console.log(`${urls.length} movie pages in ${BASE}/sitemap-movies.xml`)

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i'))
  return m ? m[1].replace(/&amp;/g, '&') : null
}

async function check(url) {
  const out = { url, problems: [] }
  try {
    const page = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) })
    const html = await page.text()
    out.img = meta(html, 'twitter:image') || meta(html, 'og:image')
    if (page.status !== 200) out.problems.push(`page ${page.status}`)
    if (meta(html, 'twitter:card') !== 'summary_large_image') out.problems.push('no large-image card')
    if (!meta(html, 'og:title')) out.problems.push('no title')
    if (!out.img) { out.problems.push('no image tag'); return out }
    const t0 = Date.now()
    const res = await fetch(out.img, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) })
    const bytes = (await res.arrayBuffer()).byteLength
    const ms = Date.now() - t0
    if (res.status !== 200) out.problems.push(`image ${res.status}`)
    else if (!/^image\//.test(res.headers.get('content-type') || '')) out.problems.push(`image is ${res.headers.get('content-type')}`)
    else if (bytes < 8000) out.problems.push(`image only ${bytes} bytes`)
    else if (bytes > 5 * 1024 * 1024) out.problems.push('image over 5 MB')
    if (res.status === 200 && ms > SLOW_MS) out.problems.push(`slow image (${ms} ms, cached now)`)
  } catch (err) {
    out.problems.push(`${err.name === 'TimeoutError' ? 'timeout' : 'failed'}: ${err.message}`)
  }
  return out
}

const results = []
let next = 0
await Promise.all(Array.from({ length: CONC }, async () => {
  while (next < urls.length) { const i = next++; results[i] = await check(urls[i]) }
}))

// a slow image is warm after the first fetch, and an error is often a passing network problem: look at those once more, alone
for (const r of results.filter((x) => x.problems.length && !x.problems.some((p) => p.startsWith('image 4')))) {
  const again = await check(r.url)
  console.log(`  rechecked ${r.url.replace(`${BASE}/movie/`, '')}: ${again.problems.length ? again.problems.join('; ') : 'fine now'}`)
  Object.assign(r, again)
}

const bad = results.filter((r) => r.problems.length)
console.log(`\n${results.length - bad.length} of ${results.length} cards are fine, ${bad.length} have a problem`)
for (const r of bad) console.log(` - ${r.url.replace(`${BASE}/movie/`, '')} | ${r.img || '(no image)'} | ${r.problems.join('; ')}`)
process.exit(bad.length ? 1 : 0)
