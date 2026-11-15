// node scripts/test-indexnow-diff.mjs — which pages a deploy announces to IndexNow (scripts/lib/indexnowDiff.mjs)
import assert from 'node:assert/strict'
import { diffSitemaps, parseSitemap, parseSitemapIndex, urlsToSend } from './lib/indexnowDiff.mjs'

const urlset = (rows) => `<?xml version="1.0"?><urlset>${rows.map(([loc, lastmod]) => `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('')}</urlset>`
const before = parseSitemap(urlset([['https://vexn.org/', '2026-11-14'], ['https://vexn.org/movie/a', '2026-11-01'], ['https://vexn.org/movie/gone', '2026-10-01'], ['https://vexn.org/category/milf', '2026-11-10T08:00:00Z']]))
const after = parseSitemap(urlset([['https://vexn.org/', '2026-11-14'], ['https://vexn.org/movie/a', '2026-11-15'], ['https://vexn.org/movie/new', '2026-11-15'], ['https://vexn.org/category/milf', '2026-11-10T21:30:00Z']]))

const cases = [
  () => assert.equal(before.get('https://vexn.org/movie/a'), '2026-11-01'),
  () => assert.equal(parseSitemap(urlset([['https://vexn.org/movies?q=a&amp;page=2']])).has('https://vexn.org/movies?q=a&page=2'), true),
  () => assert.deepEqual(parseSitemapIndex('<sitemapindex><sitemap><loc>https://vexn.org/sitemap-movies.xml</loc></sitemap><sitemap><loc>https://vexn.org/sitemap-pages.xml</loc></sitemap></sitemapindex>'), ['https://vexn.org/sitemap-movies.xml', 'https://vexn.org/sitemap-pages.xml']),
  () => assert.deepEqual(parseSitemapIndex(urlset([['https://vexn.org/']])), []), // a urlset is not an index
  // new, changed (by day) and removed; an unchanged page and a time-of-day change are not sent
  () => assert.deepEqual(diffSitemaps(before, after), { added: ['https://vexn.org/movie/new'], changed: ['https://vexn.org/movie/a'], removed: ['https://vexn.org/movie/gone'] }),
  () => assert.deepEqual(urlsToSend(diffSitemaps(before, after), 'vexn.org'), ['https://vexn.org/movie/new', 'https://vexn.org/movie/a', 'https://vexn.org/movie/gone']),
  // another host, duplicates and junk are dropped; the limit holds
  () => assert.deepEqual(urlsToSend({ added: ['https://vexn.org/x', 'https://example.com/y', 'https://vexn.org/x', 'not a url'] }, 'vexn.org'), ['https://vexn.org/x']),
  () => assert.equal(urlsToSend({ added: Array.from({ length: 50 }, (_, i) => `https://vexn.org/movie/${i}`) }, 'vexn.org', 20).length, 20),
  () => assert.deepEqual(diffSitemaps(after, after), { added: [], changed: [], removed: [] }),
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 4).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
