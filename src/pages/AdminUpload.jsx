import { useState } from 'react'
import Papa from 'papaparse'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import { getPosterUrl } from '../lib/poster'
import { sourceFromUrl } from '../lib/source'
import { normalizeTags } from '../lib/categories'
import { DEFAULT_CHANNEL } from '../lib/siteConfig'
import { checkContent, describe } from '../lib/contentRules'
import Seo from '../components/Seo'

// Expected CSV headers (see /sample-data/movies-template.csv):
// title, year, poster_url, trailer_url, description, keywords, tags, actors, channel, rating, runtime_minutes, featured
// title and trailer_url (the video source) are required; see src/lib/contentRules.js
// for the themes that are blocked or flagged for review.
const REQUIRED = ['title', 'trailer_url']

export default function AdminUpload() {
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)

  function onFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows(res.data)
        setLog([])
      },
      error: (err) => setLog([{ type: 'err', msg: `Parse error: ${err.message}` }]),
    })
  }

  async function upload() {
    setBusy(true)
    const entries = []
    const localLog = []

    for (const [i, row] of rows.entries()) {
      const missing = REQUIRED.filter((f) => !row[f]?.trim())
      if (missing.length) {
        localLog.push({ type: 'err', msg: `Row ${i + 2}: missing ${missing.join(', ')} — skipped` })
        continue
      }
      const hits = checkContent(row)
      if (hits.block.length) {
        localLog.push({ type: 'err', msg: `Row ${i + 2} "${row.title.trim()}": blocked (${describe(hits.block)}) — skipped` })
        continue
      }
      if (hits.review.length) {
        localLog.push({ type: 'ok', msg: `Row ${i + 2} "${row.title.trim()}": imported, but needs a look (${describe(hits.review)})` })
      }
      const normalized = normalizeTags(row.tags)
      if (normalized.changes.length) {
        localLog.push({ type: 'ok', msg: `Row ${i + 2} "${row.title.trim()}": tags tidied (${normalized.changes.map((c) => `${c.from} → ${c.to}`).join(', ')})` })
      }
      entries.push({
        title: row.title.trim(),
        slug: slugify(row.title),
        year: row.year ? Number(row.year) : null,
        poster_url: row.poster_url?.trim() || getPosterUrl({ trailer_url: row.trailer_url?.trim() }),
        trailer_url: row.trailer_url?.trim() || null,
        description: row.description?.trim() || null,
        keywords: row.keywords?.trim() || null,
        tags: normalized.tags || null,
        actors: row.actors?.trim() || null,
        channel: row.channel?.trim() || DEFAULT_CHANNEL, // studio or app; the player's site goes in `source`
        source: sourceFromUrl(row.trailer_url),
        rating: row.rating ? Number(row.rating) : null,
        runtime_minutes: row.runtime_minutes ? Number(row.runtime_minutes) : null,
        featured: ['true', '1', 'yes'].includes((row.featured || '').toLowerCase()),
      })
    }

    if (entries.length > 0) {
      // upsert on slug so re-uploading the same CSV updates existing rows
      const { error, count } = await supabase
        .from('movies')
        .upsert(entries, { onConflict: 'slug', count: 'exact' })
      if (error) {
        localLog.push({ type: 'err', msg: `Insert failed: ${error.message}` })
      } else {
        localLog.push({ type: 'ok', msg: `Inserted/updated ${entries.length} movies successfully.` })
      }
    }

    setLog(localLog)
    setBusy(false)
  }

  return (
    <>
      <Seo title="Bulk upload movies" description="Admin: bulk upload movies via CSV." noindex />
      <div className="container" style={{ padding: '48px 24px', maxWidth: 760 }}>
        <div className="section-head"><h2>Bulk upload movies</h2></div>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Upload a CSV with columns: <code>title, year, poster_url, trailer_url, description,
          keywords, tags, actors, channel, rating, runtime_minutes, featured</code>. Use commas inside
          a quoted field for multiple <code>tags</code> or <code>actors</code> (e.g. <code>"Action, Sci-Fi"</code>).
          For <code>poster_url</code>, paste a
          direct image link (right-click a Google Images result → "Copy image address").{' '}
          <a href="/sample-data/movies-template.csv" download style={{ color: 'var(--gold)' }}>
            Download a template →
          </a>
        </p>

        <div className="csv-drop">
          <input type="file" accept=".csv" onChange={onFile} />
          {fileName && <p style={{ marginTop: 12 }}>{fileName} — {rows.length} rows parsed</p>}
        </div>

        {rows.length > 0 && (
          <button className="btn" style={{ marginTop: 20 }} disabled={busy} onClick={upload}>
            {busy ? 'Uploading…' : `Upload ${rows.length} movies to Supabase`}
          </button>
        )}

        {log.length > 0 && (
          <div style={{ marginTop: 24 }}>
            {log.map((l, i) => (
              <div key={i} className={`log-line ${l.type === 'err' ? 'log-err' : 'log-ok'}`}>
                {l.type === 'err' ? '✕' : '✓'} {l.msg}
              </div>
            ))}
          </div>
        )}

        <p style={{ marginTop: 32 }}>
          <Link to="/admin/movie" style={{ color: 'var(--gold)' }}>Add a single movie instead →</Link>
          {' · '}
          <Link to="/admin/article" style={{ color: 'var(--gold)' }}>Write an article →</Link>
        </p>
      </div>
    </>
  )
}
