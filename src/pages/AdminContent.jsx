import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import { checkContent, describe } from '../lib/contentRules'
import Seo from '../components/Seo'

// "Site content": the hand-written text that is not a movie or an article. One screen for the channel
// intros, performer bios, category pages and footer partners, so none of it needs SQL any more.
// Writes go through the admin policies (migrations 009, 011 and 014); a visitor cannot write.
const SECTIONS = {
  channel: {
    label: 'Channel intros', table: 'channel_descriptions', key: 'slug', select: 'slug,description', pageBase: '/channel/',
    help: 'Shown at the top of a channel page. Describe what the channel really holds (runtime range, common tags, how it plays). Leave out exact counts: they go stale.',
    fields: [{ name: 'description', label: 'Intro', type: 'textarea', rows: 7, max: 700 }],
  },
  performer: {
    label: 'Performer bios', table: 'performer_descriptions', key: 'slug', select: 'slug,description', pageBase: '/actor/',
    help: 'Shown at the top of a performer page. Use only what the catalogue shows (titles, channels, co-stars, runtimes); no personal claims.',
    fields: [{ name: 'description', label: 'Bio', type: 'textarea', rows: 7, max: 700 }],
  },
  category: {
    label: 'Category pages', table: 'category_descriptions', key: 'slug', select: 'slug,title,intro,seo_title,seo_description,is_indexable', pageBase: '/category/',
    help: 'Heading, intro and search wording of a category page. The FAQ of a category is not edited here.',
    fields: [
      { name: 'title', label: 'Heading (H1)', type: 'text', max: 80 },
      { name: 'intro', label: 'Intro', type: 'textarea', rows: 7, max: 900 },
      { name: 'seo_title', label: 'Search title', type: 'text', min: 30, max: 60 },
      { name: 'seo_description', label: 'Search description', type: 'textarea', rows: 3, min: 140, max: 160 },
      { name: 'is_indexable', label: 'Let search engines index this page', type: 'checkbox' },
    ],
    defaults: { is_indexable: true },
  },
  partner: {
    label: 'Partners', table: 'footer_partners', key: 'id', select: 'id,name,url,label,description,details,rel,is_active,sort_order',
    help: 'Links in the footer and on /partners. Pause a partner instead of deleting it.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'url', label: 'Link (with the referral parameter)', type: 'url', required: true },
      { name: 'label', label: 'Link text (blank = the name)', type: 'text' },
      { name: 'description', label: 'One-line summary', type: 'textarea', rows: 2, max: 200 },
      { name: 'details', label: 'Details for the /partners page (blank line = new paragraph)', type: 'textarea', rows: 6 },
      { name: 'rel', label: 'rel attribute', type: 'text' },
      { name: 'sort_order', label: 'Order (lowest first)', type: 'number' },
      { name: 'is_active', label: 'Show it on the site', type: 'checkbox' },
    ],
    defaults: { rel: 'sponsored noopener', sort_order: 100, is_active: true },
  },
}
const TEXT_SECTIONS = new Set(['channel', 'performer', 'category'])

const blank = (section) => {
  const s = SECTIONS[section]
  return Object.fromEntries(s.fields.map((f) => [f.name, s.defaults?.[f.name] ?? (f.type === 'checkbox' ? false : '')]))
}
const fromRow = (section, row) => {
  const out = blank(section)
  for (const f of SECTIONS[section].fields) if (row[f.name] != null) out[f.name] = f.type === 'number' ? String(row[f.name]) : row[f.name]
  return out
}

// Every channel name in use (the movies table has no channels table), 1000 rows at a time.
async function channelsInUse() {
  const names = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('movies').select('channel').not('channel', 'is', null).range(from, from + 999)
    if (error) throw error
    for (const r of data) names.set(slugify(r.channel), r.channel)
    if (data.length < 1000) break
  }
  return names
}

export default function AdminContent() {
  const [section, setSection] = useState('channel')
  // rows are stored with the section they were loaded for, so a tab switch never shows another tab's rows
  const [loaded, setLoaded] = useState({ section: null, rows: [] })
  const [channelNames, setChannelNames] = useState(new Map())
  const [selected, setSelected] = useState(null) // a slug, a partner id or '__new'
  const [form, setForm] = useState({})
  const [newName, setNewName] = useState('')
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const s = SECTIONS[section]

  const load = useCallback(async (id) => {
    const cfg = SECTIONS[id]
    const query = supabase.from(cfg.table).select(cfg.select).order(id === 'partner' ? 'sort_order' : 'slug')
    const { data, error } = await query
    if (error) { setStatus({ type: 'err', msg: error.message }); return }
    if (id === 'channel') {
      try { setChannelNames(await channelsInUse()) } catch (e) { setStatus({ type: 'err', msg: e.message }) }
    }
    setLoaded({ section: id, rows: data })
  }, [])

  useEffect(() => {
    setSelected(null); setForm({}); setFilter(''); setNewName(''); setStatus(null)
    load(section)
  }, [section, load])

  const rows = loaded.section === section ? loaded.rows : []

  // the list on the left: [{ key, label, done }]
  const entries = useMemo(() => {
    if (section === 'partner') return rows.map((r) => ({ key: r.id, label: r.is_active ? r.name : `${r.name} (paused)`, done: true }))
    const map = new Map(rows.map((r) => [r.slug, { key: r.slug, label: r.slug, done: true }]))
    if (section === 'channel') {
      // every channel in use, with its proper name; the ones without text yet are marked
      for (const [slug, name] of channelNames) map.set(slug, { key: slug, label: name, done: map.has(slug) })
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [rows, channelNames, section])
  const shown = entries.filter((e) => e.label.toLowerCase().includes(filter.toLowerCase()))

  function pick(key) {
    setStatus(null)
    setSelected(key)
    const row = rows.find((r) => r[s.key] === key)
    setForm(row ? fromRow(section, row) : blank(section))
  }
  function addByName(e) {
    e.preventDefault()
    const slug = slugify(newName)
    if (!slug) return
    setNewName('')
    pick(slug)
  }
  const update = (name, value) => setForm((f) => ({ ...f, [name]: value }))

  async function save(e) {
    e.preventDefault()
    setStatus(null)
    const payload = {}
    for (const f of s.fields) {
      let v = form[f.name]
      if (f.type === 'checkbox') payload[f.name] = Boolean(v)
      else if (f.type === 'number') payload[f.name] = v === '' || v == null ? null : Number(v)
      else {
        v = String(v ?? '').trim()
        if (f.required && !v) { setStatus({ type: 'err', msg: `${f.label} is required.` }); return }
        payload[f.name] = v || null
      }
    }
    if (TEXT_SECTIONS.has(section)) {
      const hits = checkContent({ title: payload.title || '', description: [payload.description, payload.intro, payload.seo_description].filter(Boolean).join(' ') })
      if (hits.block.length) { setStatus({ type: 'err', msg: `Not saved: blocked wording (${describe(hits.block)}).` }); return }
    }
    setBusy(true)
    let res
    if (section === 'partner') {
      res = selected === '__new'
        ? await supabase.from(s.table).insert(payload)
        : await supabase.from(s.table).update(payload).eq('id', selected)
    } else {
      res = await supabase.from(s.table).upsert({ slug: selected, ...payload }, { onConflict: 'slug' })
    }
    setBusy(false)
    if (res.error) { setStatus({ type: 'err', msg: res.error.message }); return }
    setStatus({ type: 'ok', msg: 'Saved. Open pages pick it up on the next load; the prerendered HTML changes at the next deploy.' })
    await load(section)
    if (selected === '__new') setSelected(null)
  }

  const title = section === 'partner' ? form.name : selected
  return (
    <>
      <Seo title="Site content" description="Admin: edit channel intros, performer bios, category pages and partners." noindex />
      <div className="container" style={{ padding: '48px 24px' }}>
        <div className="section-head"><h2>Site content</h2></div>
        <div className="admin-tabs" role="tablist">
          {Object.entries(SECTIONS).map(([id, cfg]) => (
            <button key={id} role="tab" aria-selected={section === id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>{cfg.label}</button>
          ))}
        </div>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '72ch' }}>{s.help}</p>

        <div className="admin-content">
          <div>
            <input type="search" className="admin-content-filter" placeholder="Filter the list" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter the list" />
            <div className="admin-content-list">
              {section === 'partner' && <button type="button" className={selected === '__new' ? 'active' : ''} onClick={() => pick('__new')}>+ New partner</button>}
              {shown.map((e) => (
                <button type="button" key={e.key} className={selected === e.key ? 'active' : ''} onClick={() => pick(e.key)}>
                  {e.label}{!e.done && <span className="hint"> · no text yet</span>}
                </button>
              ))}
              {shown.length === 0 && <p className="hint">Nothing matches.</p>}
            </div>
            {section !== 'partner' && (
              <form onSubmit={addByName} className="admin-content-add">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={section === 'channel' ? 'Channel name' : section === 'performer' ? 'Performer name' : 'Category name'} aria-label="Add by name" />
                <button className="btn btn-outline btn-sm" type="submit">Add</button>
              </form>
            )}
          </div>

          <div>
            {selected === null ? (
              <p className="hint">Pick an entry on the left{section === 'partner' ? ' or add a new partner' : ', or add one by name'}.</p>
            ) : (
              <form onSubmit={save} className="admin-movie-form" style={{ marginTop: 0 }}>
                <h3 style={{ margin: 0 }}>{selected === '__new' ? 'New partner' : title}</h3>
                {s.fields.map((f) => (
                  f.type === 'checkbox' ? (
                    <label key={f.name} className="admin-checkbox">
                      <input type="checkbox" checked={Boolean(form[f.name])} onChange={(e) => update(f.name, e.target.checked)} />
                      {f.label}
                    </label>
                  ) : (
                    <label key={f.name}>
                      <span>
                        {f.label}{f.required ? ' *' : ''}
                        {(f.max || f.min) && (
                          <span className="hint" style={{ marginLeft: 8, color: counterColor(String(form[f.name] || '').length, f) }}>
                            {String(form[f.name] || '').length} characters{f.min ? ` (aim for ${f.min}–${f.max})` : ` (up to ${f.max})`}
                          </span>
                        )}
                      </span>
                      {f.type === 'textarea'
                        ? <textarea rows={f.rows || 4} value={form[f.name] ?? ''} onChange={(e) => update(f.name, e.target.value)} />
                        : <input type={f.type} value={form[f.name] ?? ''} onChange={(e) => update(f.name, e.target.value)} required={f.required} />}
                    </label>
                  )
                ))}
                {status && <p className={`log-line ${status.type === 'ok' ? 'log-ok' : 'log-err'}`}>{status.msg}</p>}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                  {s.pageBase && selected !== '__new' && <Link to={`${s.pageBase}${selected}`} style={{ color: 'var(--gold)' }}>View the page →</Link>}
                </div>
              </form>
            )}
            {selected === null && status && <p className={`log-line ${status.type === 'ok' ? 'log-ok' : 'log-err'}`}>{status.msg}</p>}
          </div>
        </div>
      </div>
    </>
  )
}

// grey inside the range, the accent colour outside it
function counterColor(len, f) {
  if (!len) return undefined
  if (len > (f.max || Infinity) || len < (f.min || 0)) return 'var(--accent)'
  return undefined
}
