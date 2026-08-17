import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import Seo from '../components/Seo'

const empty = {
  title: '',
  cover_image_url: '',
  excerpt: '',
  content: '',
  keywords: '',
  tags: '',
  seo_title: '',
  seo_description: '',
  author: 'CineVault Team',
}

export default function AdminArticle() {
  const [form, setForm] = useState(empty)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setBusy(true)
    const slug = slugify(form.title)
    const { error } = await supabase.from('articles').insert({ ...form, slug, published: true })
    setBusy(false)
    if (error) {
      setStatus({ type: 'err', msg: error.message })
    } else {
      setStatus({ type: 'ok', msg: 'Article published.' })
      setTimeout(() => navigate(`/article/${slug}`), 800)
    }
  }

  return (
    <>
      <Seo title="Write an article" description="Admin: publish a new article." noindex />
      <div className="container" style={{ padding: '48px 24px', maxWidth: 680 }}>
        <div className="section-head"><h2>Write an article</h2></div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Title *</label>
            <input value={form.title} onChange={(e) => update('title', e.target.value)} required />
          </div>
          <div className="field">
            <label>Cover image URL</label>
            <input value={form.cover_image_url} onChange={(e) => update('cover_image_url', e.target.value)} />
          </div>
          <div className="field">
            <label>Excerpt (shown on cards + as fallback meta description)</label>
            <textarea value={form.excerpt} onChange={(e) => update('excerpt', e.target.value)} rows={2} />
          </div>
          <div className="field">
            <label>Content (HTML allowed)</label>
            <textarea value={form.content} onChange={(e) => update('content', e.target.value)} rows={10} />
          </div>
          <div className="field">
            <label>SEO keywords (comma-separated)</label>
            <input value={form.keywords} onChange={(e) => update('keywords', e.target.value)} />
          </div>
          <div className="field">
            <label>Tags (comma-separated)</label>
            <input value={form.tags} onChange={(e) => update('tags', e.target.value)} />
          </div>
          <div className="field">
            <label>SEO title override (optional)</label>
            <input value={form.seo_title} onChange={(e) => update('seo_title', e.target.value)} />
          </div>
          <div className="field">
            <label>SEO description override (optional)</label>
            <textarea value={form.seo_description} onChange={(e) => update('seo_description', e.target.value)} rows={2} />
          </div>
          <div className="field">
            <label>Author</label>
            <input value={form.author} onChange={(e) => update('author', e.target.value)} />
          </div>

          <button className="btn" disabled={busy} type="submit">
            {busy ? 'Publishing…' : 'Publish article'}
          </button>
        </form>

        {status && (
          <p className={`log-line ${status.type === 'err' ? 'log-err' : 'log-ok'}`} style={{ marginTop: 16 }}>
            {status.type === 'err' ? '✕' : '✓'} {status.msg}
          </p>
        )}

        <p style={{ marginTop: 32 }}>
          <Link to="/admin/upload" style={{ color: 'var(--gold)' }}>← Bulk upload movies instead</Link>
        </p>
      </div>
    </>
  )
}
