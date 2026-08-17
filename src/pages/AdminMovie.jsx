import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import Seo from '../components/Seo'

const EMPTY = {
  title: '',
  year: '',
  poster_url: '',
  trailer_url: '',
  description: '',
  keywords: '',
  tags: '',
  actors: '',
  channel: '',
  rating: '',
  runtime_minutes: '',
  featured: false,
}

// Turn a movies row into form-shaped strings (inputs need strings, not
// numbers/null) so editing an existing movie pre-fills cleanly.
function toFormValues(row) {
  return {
    title: row.title || '',
    year: row.year != null ? String(row.year) : '',
    poster_url: row.poster_url || '',
    trailer_url: row.trailer_url || '',
    description: row.description || '',
    keywords: row.keywords || '',
    tags: row.tags || '',
    actors: row.actors || '',
    channel: row.channel || '',
    rating: row.rating != null ? String(row.rating) : '',
    runtime_minutes: row.runtime_minutes != null ? String(row.runtime_minutes) : '',
    featured: !!row.featured,
  }
}

export default function AdminMovie() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const editSlug = searchParams.get('slug')

  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [loadingMovie, setLoadingMovie] = useState(!!editSlug)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [log, setLog] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!editSlug) {
      setEditingId(null)
      setForm(EMPTY)
      return
    }
    setLoadingMovie(true)
    supabase
      .from('movies')
      .select('*')
      .eq('slug', editSlug)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setLog({ type: 'err', msg: `Couldn't load "${editSlug}" to edit.` })
          setEditingId(null)
        } else {
          setForm(toFormValues(data))
          setEditingId(data.id)
        }
        setLoadingMovie(false)
      })
    return () => { cancelled = true }
  }, [editSlug])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) {
      setLog({ type: 'err', msg: 'Title is required.' })
      return
    }
    setBusy(true)
    setLog(null)

    const entry = {
      title: form.title.trim(),
      slug: slugify(form.title),
      year: form.year ? Number(form.year) : null,
      poster_url: form.poster_url.trim() || null,
      trailer_url: form.trailer_url.trim() || null,
      description: form.description.trim() || null,
      keywords: form.keywords.trim() || null,
      tags: form.tags.trim() || null,
      actors: form.actors.trim() || null,
      channel: form.channel.trim() || null,
      rating: form.rating ? Number(form.rating) : null,
      runtime_minutes: form.runtime_minutes ? Number(form.runtime_minutes) : null,
      featured: form.featured,
    }

    const { error } = editingId
      // Editing an existing row: update by id so changing the title
      // (and therefore the slug) doesn't create a duplicate row.
      ? await supabase.from('movies').update(entry).eq('id', editingId)
      // Adding new: upsert on slug — same as the CSV importer, so
      // re-submitting the same title updates the existing row instead
      // of duplicating it.
      : await supabase.from('movies').upsert([entry], { onConflict: 'slug' })

    if (error) {
      setLog({ type: 'err', msg: `Save failed: ${error.message}` })
    } else {
      setLog({ type: 'ok', msg: `Saved "${entry.title}" (/movie/${entry.slug}).` })
      if (editingId) {
        // Stay in edit mode but point the URL at the (possibly new) slug.
        navigate(`/admin/movie?slug=${entry.slug}`, { replace: true })
      } else {
        setForm(EMPTY)
      }
    }
    setBusy(false)
  }

  async function onDelete() {
    if (!editingId) return
    if (!window.confirm(`Delete "${form.title}"? This can't be undone.`)) return
    setDeleting(true)
    setLog(null)
    const { error } = await supabase.from('movies').delete().eq('id', editingId)
    setDeleting(false)
    if (error) {
      setLog({ type: 'err', msg: `Delete failed: ${error.message}` })
    } else {
      navigate('/admin/movie', { replace: true })
    }
  }

  if (loadingMovie) {
    return (
      <>
        <Seo title="Edit movie" description="Admin: edit a movie." noindex />
        <div className="container" style={{ padding: '48px 24px', maxWidth: 640 }}>
          <div className="section-head"><h2>Loading movie…</h2></div>
        </div>
      </>
    )
  }

  return (
    <>
      <Seo title={editingId ? 'Edit movie' : 'Add a movie'} description="Admin: add or edit a movie." noindex />
      <div className="container" style={{ padding: '48px 24px', maxWidth: 640 }}>
        <div className="section-head"><h2>{editingId ? `Edit "${form.title}"` : 'Add a single movie'}</h2></div>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {editingId
            ? 'Update any field and save — changes go live immediately.'
            : 'Same fields as the CSV importer, one at a time. Submitting a title that already exists updates that movie instead of creating a duplicate.'}
        </p>

        <form onSubmit={onSubmit} className="admin-movie-form">
          <label>
            Title *
            <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} required />
          </label>

          <div className="admin-form-row">
            <label>
              Year
              <input type="number" value={form.year} onChange={(e) => update('year', e.target.value)} placeholder="2026" />
            </label>
            <label>
              Rating (0–10)
              <input type="number" step="0.1" min="0" max="10" value={form.rating} onChange={(e) => update('rating', e.target.value)} placeholder="7.5" />
            </label>
            <label>
              Runtime (minutes)
              <input type="number" value={form.runtime_minutes} onChange={(e) => update('runtime_minutes', e.target.value)} placeholder="118" />
            </label>
          </div>

          <label>
            Poster image URL
            <input type="url" value={form.poster_url} onChange={(e) => update('poster_url', e.target.value)} placeholder="https://..." />
          </label>

          <label>
            Trailer URL
            <input
              type="url"
              value={form.trailer_url}
              onChange={(e) => update('trailer_url', e.target.value)}
              placeholder="YouTube link, Vimeo link, or any /embed/ URL"
            />
          </label>

          <label>
            Description
            <textarea rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} />
          </label>

          <div className="admin-form-row">
            <label>
              Tags <span className="hint">(comma-separated)</span>
              <input type="text" value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="Action, Sci-Fi" />
            </label>
            <label>
              Actors <span className="hint">(comma-separated)</span>
              <input type="text" value={form.actors} onChange={(e) => update('actors', e.target.value)} placeholder="Actor One, Actor Two" />
            </label>
          </div>

          <div className="admin-form-row">
            <label>
              Channel
              <input type="text" value={form.channel} onChange={(e) => update('channel', e.target.value)} />
            </label>
            <label>
              SEO keywords
              <input type="text" value={form.keywords} onChange={(e) => update('keywords', e.target.value)} />
            </label>
          </div>

          <label className="admin-checkbox">
            <input type="checkbox" checked={form.featured} onChange={(e) => update('featured', e.target.checked)} />
            Feature this movie on the homepage
          </label>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn" type="submit" disabled={busy || deleting}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Save movie'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy || deleting}
                onClick={onDelete}
                style={{ borderColor: 'var(--danger, #c0392b)', color: 'var(--danger, #c0392b)' }}
              >
                {deleting ? 'Deleting…' : 'Delete movie'}
              </button>
            )}
          </div>
        </form>

        {log && (
          <div style={{ marginTop: 20 }}>
            <div className={`log-line ${log.type === 'err' ? 'log-err' : 'log-ok'}`}>
              {log.type === 'err' ? '✕' : '✓'} {log.msg}
            </div>
          </div>
        )}

        <p style={{ marginTop: 32 }}>
          {editingId ? (
            <Link to="/admin/movie" style={{ color: 'var(--gold)' }}>← Add a new movie instead</Link>
          ) : (
            <Link to="/admin/upload" style={{ color: 'var(--gold)' }}>Bulk upload via CSV instead →</Link>
          )}
        </p>
      </div>
    </>
  )
}
