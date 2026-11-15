// npm run link-tool          (node scripts/link-tool/server.mjs [--port=5190] [--no-open])
//
// A small app that runs on this PC: paste Eporner links (a video, a playlist, a tag, a performer, a channel, a
// category, a search, an uploader's videos), review and edit the drafts, and get one SQL insert for public.movies.
// It reads Eporner and the site's database with the public key only and never writes to the database: the SQL is
// shown for copying and saved in Downloads, to run in the Supabase SQL editor. Logic: scripts/lib/linkImport.mjs.
import { createServer } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { MIN_MINUTES, checkRow, defaultInclude, draftRow, mendRow, parseLink, parseListPage, parseWatchPage, redraftRow, rowsToSql, seoChecklist, splitKeywords } from '../lib/linkImport.mjs'
import { slugify } from '../../src/lib/slugify.js'
import { LABEL_TAGS } from '../../src/lib/categories.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const PORT = Number(args.port || 5190)

const env = { ...process.env }
const envFile = join(ROOT, '.env')
if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const SB = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
if (!SB || !ANON) { console.error('The link tool needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'); process.exit(1) }

// ---- Eporner, politely: one request at a time, ~0.7 s apart, remembered for this run ----------------------------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const memo = new Map()
let lastCall = 0
let queue = Promise.resolve()
function get(url, { json = false } = {}) {
  const key = `${json ? 'json' : 'html'} ${url}`
  if (memo.has(key)) return memo.get(key)
  const job = queue.then(async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const wait = lastCall + 700 - Date.now()
      if (wait > 0) await sleep(wait)
      lastCall = Date.now()
      try {
        const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })
        if (res.status === 404 || res.status === 410) return null
        if (res.ok) return json ? await res.json() : await res.text()
      } catch { /* try again */ }
      await sleep(1200 * attempt)
    }
    return null
  })
  queue = job.catch(() => null)
  memo.set(key, job)
  job.then((v) => { if (v == null) memo.delete(key) }) // a failed read is tried again next time
  return job
}
async function posterWorks(url) {
  if (!url) return false
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0', 'user-agent': UA }, signal: AbortSignal.timeout(15000) })
    return res.status === 200 || res.status === 206
  } catch { return false }
}

// ---- the site's catalogue (public key, read-only) --------------------------------------------------------------
async function rest(path) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SB}/rest/v1/${path}${path.includes('?') ? '&' : '?'}offset=${from}&limit=1000`, { headers: { apikey: ANON } })
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error(`database read failed: ${JSON.stringify(data).slice(0, 160)}`)
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}
let site = null
async function loadSite() {
  const movies = await rest('movies?select=slug,title,seo_title,seo_description,trailer_url,channel,tags&order=id')
  const removed = new Set((await rest('removed_movies?select=slug&order=slug')).map((r) => String(r.slug).toLowerCase()))
  const lowerSet = (k) => new Set(movies.map((m) => String(m[k] || '').toLowerCase()).filter(Boolean))
  const channels = new Map()
  const channelCount = new Map()
  for (const m of movies) {
    if (!m.channel) continue
    channelCount.set(m.channel, (channelCount.get(m.channel) || 0) + 1)
    if (m.channel !== 'VEXN') channels.set(slugify(m.channel), m.channel)
  }
  const tagUse = new Map()
  for (const m of movies) for (const t of String(m.tags || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const s = slugify(t)
    const e = tagUse.get(s) || { n: 0, names: new Map() }
    e.n++
    e.names.set(t, (e.names.get(t) || 0) + 1)
    tagUse.set(s, e)
  }
  const freeAllowed = new Map([...tagUse].filter(([s, e]) => e.n >= 3 && !LABEL_TAGS.has(s)).map(([s, e]) => [s, [...e.names].sort((a, b) => b[1] - a[1])[0][0]]))
  site = {
    count: movies.length,
    channels,
    channelNames: [...channelCount].sort((a, b) => b[1] - a[1]).map(([name]) => name),
    freeAllowed,
    codes: new Set(movies.map((m) => (m.trailer_url || '').match(/embed\/([A-Za-z0-9]+)/)?.[1]).filter(Boolean)),
    removed,
    taken: { slug: lowerSet('slug'), title: lowerSet('title'), seo_title: lowerSet('seo_title'), seo_description: lowerSet('seo_description') },
    loadedAt: new Date().toISOString(),
  }
  return site
}

// ---- one video ---------------------------------------------------------------------------------------------------
async function readVideo(code, extras) {
  const [api, html] = [await get(`https://www.eporner.com/api/v2/video/id/?id=${code}&thumbsize=big&format=json`, { json: true }), await get(`https://www.eporner.com/video-${code}/`)]
  const watch = parseWatchPage(html)
  if (!html || watch.dead) return { code, error: 'the video page is gone' }
  if (!api || Array.isArray(api) || !api.id) return { code, error: 'not in the Eporner API (it may not play in an embed)' }
  const row = draftRow({ code, api, watch }, site, { extras })
  if (!(await posterWorks(row.poster_url))) row.poster_url = (await posterWorks(row.poster_small)) ? row.poster_small : ''
  return row
}

// ---- HTTP --------------------------------------------------------------------------------------------------------
// onlyReady: tick only videos with nothing to check (and hold blowjob ones); off by default, every video is ticked
const opts = (b) => ({ minMinutes: Number.isFinite(Number(b.minMinutes)) ? Number(b.minMinutes) : MIN_MINUTES, skipBlowjob: b.onlyReady === true, tickAll: b.onlyReady !== true })
const extrasOf = (b) => splitKeywords(Array.isArray(b.extras) ? b.extras.join(',') : b.extras).slice(0, 12)
async function body(req) {
  let size = 0
  const chunks = []
  for await (const c of req) { size += c.length; if (size > 8e6) throw new Error('request too large'); chunks.push(c) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}
const json = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)) }

async function readLinks(req, res) {
  const b = await body(req)
  const o = opts(b)
  const pages = Math.min(Math.max(Number(b.pages) || 1, 1), 20)
  const limit = Math.min(Math.max(Number(b.limit) || 60, 1), 300)
  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' })
  const send = (msg) => res.write(`${JSON.stringify(msg)}\n`)
  try {
    send({ type: 'status', text: 'Reading the site’s catalogue…' })
    await loadSite()
    send({ type: 'site', count: site.count, channels: site.channelNames })
    const codes = []
    const seen = new Set()
    let onSite = 0
    let tooShort = 0
    const push = (code, sec) => {
      if (seen.has(code)) return
      seen.add(code)
      if (site.codes.has(code)) { onSite++; return }
      if (sec != null && sec < o.minMinutes * 60 - 60) { tooShort++; return } // a list's videos a minute or more under the minimum are not drafted
      codes.push(code)
    }
    for (const link of (b.links || []).map((l) => String(l).trim()).filter(Boolean)) {
      const parsed = parseLink(link)
      if (!parsed) { send({ type: 'note', level: 'error', text: `Not an Eporner video or list link: ${link}` }); continue }
      if (parsed.kind === 'video') { push(parsed.code, null); continue }
      let url = parsed.url
      for (let page = 1; page <= pages && url; page++) {
        send({ type: 'status', text: `Reading ${parsed.what} page ${page}…` })
        const html = await get(url)
        if (!html) { send({ type: 'note', level: 'error', text: `Could not read ${url}` }); break }
        const { items, next } = parseListPage(html)
        send({ type: 'note', text: `${parsed.what} page ${page}: ${items.length} video${items.length === 1 ? '' : 's'} (${url.replace('https://www.eporner.com', '')})` })
        for (const it of items) push(it.code, it.sec)
        if (!items.length || !next || next === url) break
        url = next
      }
    }
    const extra = codes.length > limit ? `; drafting the first ${limit}` : ''
    send({ type: 'note', text: `${codes.length} new video${codes.length === 1 ? '' : 's'} to draft${extra}. Already on the site: ${onSite}. Under ${o.minMinutes - 1} minutes, not drafted: ${tooShort}.` })
    const batch = codes.slice(0, limit)
    let drafted = 0
    for (const [i, code] of batch.entries()) {
      send({ type: 'status', text: `Drafting ${i + 1} of ${batch.length}…` })
      const row = await readVideo(code, extrasOf(b))
      if (row.error) { send({ type: 'skip', code, reason: row.error }); continue }
      row.check = checkRow(row, site, [], o)
      row.seo = seoChecklist(row, { extras: extrasOf(b), site })
      row.include = defaultInclude(row, row.check, o)
      drafted++
      send({ type: 'row', row })
    }
    send({ type: 'done', drafted, onSite, tooShort })
  } catch (err) {
    send({ type: 'note', level: 'error', text: `Stopped: ${err.message}` })
    send({ type: 'done', drafted: 0 })
  }
  res.end()
}

async function check(req, res) {
  const b = await body(req)
  if (!site) await loadSite()
  const rows = b.rows || []
  const extras = extrasOf(b)
  json(res, 200, { checks: rows.map((r) => checkRow(r, site, rows, opts(b))), seo: rows.map((r) => seoChecklist(r, { extras, site })) })
}

// write the search title, search description, page description, keywords (and an untouched address) again with the
// card's focus keyword and the extra keywords
async function redraft(req, res) {
  const b = await body(req)
  if (!site) await loadSite()
  const extras = extrasOf(b)
  json(res, 200, { drafts: (b.rows || []).map((r) => redraftRow(r, { extras, taken: site.taken })) })
}

async function makeSql(req, res) {
  const b = await body(req)
  if (!site) await loadSite()
  const ticked = (b.rows || []).map((r) => ({ ...r, include: true }))
  if (!ticked.length) return json(res, 400, { error: 'No video is ticked.' })
  // every ticked video goes in (owner's call; the SQL gets a second check before it is run): broken fields are mended
  // so no row breaks or is skipped, and what the checks find is written above each row as "-- CHECK"
  const used = new Set()
  const mended = ticked.map((r) => mendRow(r, site, used))
  const all = mended.map(({ row }) => row)
  const rows = mended.map(({ row, changes }) => {
    const c = checkRow(row, site, all, opts(b))
    return { ...row, notes: [...c.errors.map((e) => `RULE ${e}`), ...c.fixes, ...changes] }
  })
  const flagged = rows.filter((r) => r.notes.length).map((r) => ({ code: r.code, title: r.title, notes: r.notes, rule: r.notes.some((n) => n.startsWith('RULE ')) }))
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '')
  const sql = rowsToSql(rows, { note: `${stamp.replace('_', ' ')}, from ${[...new Set(b.links || [])].slice(0, 3).join(' ')}`.slice(0, 300) })
  const file = join(homedir(), 'Downloads', `vexn_link_import_${stamp}.sql`)
  try { writeFileSync(file, sql); madeFiles.add(file) } catch { /* the copy in the page is enough */ }
  json(res, 200, { sql, file: existsSync(file) ? file : null, count: rows.length, flagged })
}

// Clipboard and folder, done on this PC: the browser pane in the Claude app (and some browsers) refuse a page's
// clipboard writes and downloads. Only files this tool wrote in this run are accepted.
const madeFiles = new Set()
function run(cmd, args, input) {
  return new Promise((resolve) => {
    try {
      const p = spawn(cmd, args, { stdio: [input == null ? 'ignore' : 'pipe', 'ignore', 'ignore'], windowsHide: true })
      p.on('error', () => resolve(false))
      p.on('close', (code) => resolve(code === 0))
      if (input != null) p.stdin.end(input)
    } catch { resolve(false) }
  })
}
async function copyFile(req, res) {
  const { file } = await body(req)
  if (!madeFiles.has(file)) return json(res, 400, { ok: false, error: 'unknown file' })
  const quoted = `'${String(file).replace(/'/g, "''")}'`
  const ok = process.platform === 'win32'
    ? await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Get-Content -Raw -Encoding UTF8 -LiteralPath ${quoted} | Set-Clipboard`])
    : process.platform === 'darwin' ? await run('pbcopy', [], readFileSync(file)) : await run('xclip', ['-selection', 'clipboard'], readFileSync(file))
  json(res, ok ? 200 : 500, { ok })
}
async function revealFile(req, res) {
  const { file } = await body(req)
  if (!madeFiles.has(file)) return json(res, 400, { ok: false, error: 'unknown file' })
  if (process.platform === 'win32') spawn('explorer.exe', [`/select,${file}`], { detached: true, stdio: 'ignore' }).unref() // explorer exits 1 even when it worked
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', process.platform === 'darwin' ? ['-R', file] : [dirname(file)], { detached: true, stdio: 'ignore' }).unref()
  json(res, 200, { ok: true })
}

const server = createServer(async (req, res) => {
  // only this PC, only this page: another site open in the browser cannot call these endpoints
  const host = String(req.headers.host || '')
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) { res.writeHead(403); return res.end('forbidden') }
  try {
    const url = new URL(req.url, `http://${host}`)
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      return res.end(readFileSync(join(HERE, 'index.html')))
    }
    if (req.method === 'POST' && !String(req.headers['content-type'] || '').includes('application/json')) return json(res, 415, { error: 'JSON only' })
    if (req.method === 'POST' && url.pathname === '/api/read') return await readLinks(req, res)
    if (req.method === 'POST' && url.pathname === '/api/check') return await check(req, res)
    if (req.method === 'POST' && url.pathname === '/api/redraft') return await redraft(req, res)
    if (req.method === 'POST' && url.pathname === '/api/copy') return await copyFile(req, res)
    if (req.method === 'POST' && url.pathname === '/api/reveal') return await revealFile(req, res)
    if (req.method === 'POST' && url.pathname === '/api/sql') return await makeSql(req, res)
    res.writeHead(404)
    res.end('not found')
  } catch (err) {
    if (!res.headersSent) json(res, 500, { error: err.message })
    else res.end()
  }
})
server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}/`
  console.log(`VEXN link tool: ${url}  (Ctrl+C to stop)`)
  if (!args['no-open']) {
    const [cmd, cmdArgs] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]
    try { spawn(cmd, cmdArgs, { detached: true, stdio: 'ignore' }).unref() } catch { /* open it by hand */ }
  }
})
