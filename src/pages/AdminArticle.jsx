import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import { checkContent, describe } from '../lib/contentRules'
import { articleAdvice, cleanArticleHtml } from '../lib/articleHtml'
import Seo from '../components/Seo'

// Write and edit articles. The body is HTML: <h2>/<h3> sections, <p>, lists, links, images, quotes and tables. It is
// cleaned before saving (src/lib/articleHtml.js), so scripts, iframes and style attributes never reach the database.
// /admin/article opens a new article; /admin/article?slug=<slug> (or a click in the list) opens an existing one.
const EMPTY = {
  title: '', slug: '', cover_image_url: '', excerpt: '', content: '', keywords: '', tags: '',
  seo_title: '', seo_description: '', author: 'VEXN Editorial', published: true,
}
const TEXT_FIELDS = ['title', 'cover_image_url', 'excerpt', 'content', 'keywords', 'tags', 'seo_title', 'seo_description', 'author']

// Inserted at the cursor by the toolbar
const SNIPPETS = [
  ['H2', '<h2>Section heading</h2>\n'],
  ['H3', '<h3>Sub-heading</h3>\n'],
  ['Paragraph', '<p>Text</p>\n'],
  ['List', '<ul>\n  <li>First point</li>\n  <li>Second point</li>\n</ul>\n'],
  ['Link to VEXN', '<a href="/category/milf">MILF videos</a>'],
  ['Bold', '<strong>bold</strong>'],
  ['Image', '<img src="https://" alt="What the image shows" loading="lazy">\n'],
  ['Quote', '<blockquote>Quote</blockquote>\n'],
  ['Table', '<table>\n  <tr><th>Name</th><th>Videos</th></tr>\n  <tr><td>…</td><td>…</td></tr>\n</table>\n'],
]

const counter = (value, min, max) => {
  const n = String(value || '').length
  return <span className="hint" style={{ marginLeft: 8, color: n && (n < min || n > max) ? 'var(--accent)' : undefined }}>{n} characters ({min}–{max})</span>
}

export default function AdminArticle() {
  const [params, setParams] = useSearchParams()
  const editSlug = params.get('slug')
  const [list, setList] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [id, setId] = useState(null)
  const [view, setView] = useState('html')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const contentRef = useRef(null)

  async function loadList() {
    const { data } = await supabase.from('articles').select('id,slug,title,published,created_at').order('created_at', { ascending: false })
    setList(data || [])
  }
  useEffect(() => { loadList() }, [])

  useEffect(() => {
    let cancelled = false
    setStatus(null)
    if (!editSlug) { setForm(EMPTY); setId(null); return }
    supabase.from('articles').select('*').eq('slug', editSlug).maybeSingle().then(({ data }) => {
      if (cancelled) return
      if (!data) { setStatus({ type: 'err', msg: `No article at /article/${editSlug}` }); return }
      setId(data.id)
      setForm({ ...EMPTY, ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, data[k] ?? ''])), slug: data.slug, published: Boolean(data.published) })
    })
    return () => { cancelled = true }
  }, [editSlug])

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const preview = useMemo(() => cleanArticleHtml(form.content), [form.content])
  const advice = useMemo(() => articleAdvice(form), [form])
  const slug = id ? form.slug : slugify(form.slug || form.title)

  function insert(snippet) {
    const el = contentRef.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    const next = value.slice(0, a) + snippet + value.slice(b)
    update('content', next)
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + snippet.length })
  }

  async function save(e) {
    e.preventDefault()
    if (!form.title.trim() || !slug) return
    const content = cleanArticleHtml(form.content)
    const plain = content.replace(/<[^>]+>/g, ' ')
    const hits = checkContent({ title: form.title, slug, description: [plain, form.excerpt, form.seo_title, form.seo_description].join(' ') })
    if (hits.block.length) { setStatus({ type: 'err', msg: `Not saved: ${describe(hits.block)}. The site does not publish this theme.` }); return }
    if (hits.review.length && !window.confirm(`This article mentions ${describe(hits.review)}. Save anyway?`)) return
    const payload = {
      title: form.title.trim(), content, author: form.author.trim() || 'VEXN Editorial', published: form.published,
      ...Object.fromEntries(['cover_image_url', 'excerpt', 'keywords', 'tags', 'seo_title', 'seo_description'].map((k) => [k, form[k].trim() || null])),
    }
    setBusy(true)
    const res = id
      ? await supabase.from('articles').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
      : await supabase.from('articles').insert({ ...payload, slug })
    setBusy(false)
    if (res.error) { setStatus({ type: 'err', msg: res.error.message }); return }
    setStatus({ type: 'ok', msg: `${id ? 'Saved' : 'Created'}${form.published ? ' and published' : ' as a draft'}.`, slug })
    update('content', content)
    loadList()
    if (!id) setParams({ slug })
  }

  return (
    <>
      <Seo title={id ? 'Edit article' : 'Write an article'} description="Admin: write and edit articles." noindex />
      <div className="container admin-article" style={{ padding: '40px 24px', maxWidth: 960 }}>
        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2>{id ? `Edit: ${form.title || slug}` : 'Write an article'}</h2>
          {id && <button type="button" className="btn btn-outline btn-sm" onClick={() => setParams({})}>New article</button>}
        </div>

        <details className="admin-article-list" open={!id && !editSlug}>
          <summary>Existing articles ({list.length})</summary>
          <ul>
            {list.map((a) => (
              <li key={a.id}>
                <button type="button" className="linklike" onClick={() => setParams({ slug: a.slug })}>{a.title}</button>
                {!a.published && <span className="hint"> · draft</span>}
                {' '}<Link to={`/article/${a.slug}`} className="hint">view</Link>
              </li>
            ))}
          </ul>
        </details>

        <form onSubmit={save}>
          <div className="field">
            <label>Title (the page's H1) *</label>
            <input value={form.title} onChange={(e) => update('title', e.target.value)} required />
          </div>
          <div className="field">
            <label>Address</label>
            {id ? (
              <p className="hint">/article/{slug} (fixed once published: changing it would break links to the article)</p>
            ) : (
              <input value={form.slug} onChange={(e) => update('slug', e.target.value)} placeholder={slugify(form.title) || 'made from the title'} />
            )}
          </div>
          <div className="field">
            <label>Cover image URL</label>
            <input value={form.cover_image_url} onChange={(e) => update('cover_image_url', e.target.value)} />
          </div>
          <div className="field">
            <label>Excerpt (cards, and the search description when none is set){counter(form.excerpt, 70, 200)}</label>
            <textarea value={form.excerpt} onChange={(e) => update('excerpt', e.target.value)} rows={2} />
          </div>

          <div className="field">
            <label>Body (HTML)</label>
            <div className="admin-article-toolbar" role="toolbar" aria-label="Insert HTML">
              {SNIPPETS.map(([label, html]) => (
                <button type="button" key={label} className="btn btn-outline btn-sm" onClick={() => insert(html)} disabled={view !== 'html'}>{label}</button>
              ))}
              <span style={{ flex: 1 }} />
              <button type="button" className={`btn btn-sm ${view === 'html' ? '' : 'btn-outline'}`} onClick={() => setView('html')}>HTML</button>
              <button type="button" className={`btn btn-sm ${view === 'preview' ? '' : 'btn-outline'}`} onClick={() => setView('preview')}>Preview</button>
            </div>
            {view === 'html' ? (
              <textarea ref={contentRef} className="admin-article-html" value={form.content} onChange={(e) => update('content', e.target.value)} rows={22} spellCheck />
            ) : (
              <div className="article-body admin-article-preview" dangerouslySetInnerHTML={{ __html: preview }} />
            )}
            <ul className="admin-article-advice">
              {advice.map((a) => <li key={a.text} className={a.ok ? 'ok' : 'warn'}>{a.ok ? '✓' : '!'} {a.text}</li>)}
            </ul>
          </div>

          <div className="field">
            <label>Search title (optional; the title is used when empty){counter(form.seo_title, 30, 60)}</label>
            <input value={form.seo_title} onChange={(e) => update('seo_title', e.target.value)} />
          </div>
          <div className="field">
            <label>Search description (optional; the excerpt is used when empty){counter(form.seo_description, 140, 160)}</label>
            <textarea value={form.seo_description} onChange={(e) => update('seo_description', e.target.value)} rows={2} />
          </div>
          <div className="field">
            <label>Keywords (comma-separated)</label>
            <input value={form.keywords} onChange={(e) => update('keywords', e.target.value)} />
          </div>
          <div className="field">
            <label>Tags (comma-separated)</label>
            <input value={form.tags} onChange={(e) => update('tags', e.target.value)} />
          </div>
          <div className="field">
            <label>Author</label>
            <input value={form.author} onChange={(e) => update('author', e.target.value)} />
          </div>
          <div className="field">
            <label><input type="checkbox" checked={form.published} onChange={(e) => update('published', e.target.checked)} /> Published (untick to keep it as a draft)</label>
          </div>

          <button className="btn" disabled={busy} type="submit">{busy ? 'Saving…' : id ? 'Save changes' : 'Create article'}</button>
        </form>

        {status && (
          <p className={`log-line ${status.type === 'err' ? 'log-err' : 'log-ok'}`} style={{ marginTop: 16 }}>
            {status.type === 'err' ? '✕' : '✓'} {status.msg}{status.slug && <> <Link to={`/article/${status.slug}`}>Open the article →</Link></>}
          </p>
        )}

        <p style={{ marginTop: 32 }}>
          <Link to="/admin/upload" style={{ color: 'var(--gold)' }}>← Bulk upload movies instead</Link>
        </p>
      </div>
    </>
  )
}
