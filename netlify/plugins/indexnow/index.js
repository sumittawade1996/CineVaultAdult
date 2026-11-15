// Netlify build plugin (registered in netlify.toml): after a production deploy is live, tell IndexNow (Bing and the
// engines that share it) which pages the deploy added, changed or removed. Google does not use IndexNow; it reads the
// sitemap. The plugin never fails or blocks a deploy: any problem is logged and the deploy goes on.
//
//   onPreBuild  read the sitemap that is live on vexn.org now (before this deploy replaces it)
//   onSuccess   (runs after the deploy is live) read the sitemap this build wrote, diff, POST the difference
//
// Only for the production context (not deploy previews or branch deploys). INDEXNOW_DRY=1 lists without sending.
// Logic: scripts/lib/indexnowDiff.mjs. First manual submission: 131 pages on 2026-11-15.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { diffSitemaps, parseSitemap, parseSitemapIndex, urlsToSend } from '../../../scripts/lib/indexnowDiff.mjs'

const HOST = 'vexn.org'
const ENDPOINT = 'https://api.indexnow.org/indexnow'
let before = null // Map(loc -> lastmod) of the live sitemap, or null when it could not be read
let skip = ''

const fetchText = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'vexn-indexnow-build' }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.text()
}

export const onPreBuild = async () => {
  if (process.env.CONTEXT !== 'production') { skip = `not a production deploy (${process.env.CONTEXT || 'local'})`; return }
  try {
    const children = parseSitemapIndex(await fetchText(`https://${HOST}/sitemap.xml`))
    const map = new Map()
    for (const url of children) for (const [loc, lastmod] of parseSitemap(await fetchText(url))) map.set(loc, lastmod)
    if (!map.size) throw new Error('the live sitemap is empty')
    before = map
    console.log(`IndexNow: live sitemap has ${map.size} pages`)
  } catch (err) {
    skip = `could not read the live sitemap (${err.message}); nothing will be sent, so no page is announced twice`
  }
}

export const onSuccess = async ({ constants, utils }) => {
  const report = (summary) => { console.log(`IndexNow: ${summary}`); utils?.status?.show?.({ title: 'IndexNow', summary }) }
  if (skip) return report(`skipped: ${skip}`)
  if (!before) return report('skipped: no live sitemap was read')
  try {
    const dir = constants.PUBLISH_DIR
    const after = new Map()
    for (const f of readdirSync(dir).filter((n) => /^sitemap-.*\.xml$/.test(n))) for (const [loc, lastmod] of parseSitemap(readFileSync(join(dir, f), 'utf8'))) after.set(loc, lastmod)
    if (!after.size) return report('skipped: this build wrote no sitemap')
    const diff = diffSitemaps(before, after)
    const urls = urlsToSend(diff, HOST)
    const what = `${diff.added.length} new, ${diff.changed.length} changed, ${diff.removed.length} removed`
    if (!urls.length) return report(`nothing to send (${what})`)
    const keyFile = readdirSync(dir).find((f) => /^[a-f0-9]{32}\.txt$/.test(f))
    const key = keyFile && readFileSync(join(dir, keyFile), 'utf8').trim()
    if (!key || `${key}.txt` !== keyFile || !existsSync(join(dir, keyFile))) return report('skipped: no IndexNow key file in the published site')
    if (process.env.INDEXNOW_DRY === '1') return report(`dry run: would send ${urls.length} pages (${what}), e.g. ${urls.slice(0, 3).join(' ')}`)
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls }),
      signal: AbortSignal.timeout(30000),
    })
    const ok = res.status === 200 || res.status === 202
    report(`sent ${urls.length} pages (${what}): HTTP ${res.status}${ok ? ' accepted' : ' NOT accepted, check the key file and the addresses'}`)
  } catch (err) {
    report(`not sent: ${err.message}`)
  }
}
