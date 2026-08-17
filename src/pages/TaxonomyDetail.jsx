import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import MovieGrid from '../components/MovieGrid'
import Seo from '../components/Seo'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 20

export default function TaxonomyDetail({ field, label, backPath, backLabel }) {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') || 1))
  const [allMatches, setAllMatches] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Fetch broadly, then filter client-side by matching slug — comma
      // fields (actors/tags) can't be exact-matched in SQL reliably.
      const { data } = await supabase.from('movies').select('*').order('created_at', { ascending: false })
      const matches = (data || []).filter((m) =>
        (m[field] || '')
          .split(',')
          .map((s) => s.trim())
          .some((v) => v && slugify(v) === slug)
      )
      setAllMatches(matches)
      if (matches.length > 0) {
        const original = (matches[0][field] || '')
          .split(',')
          .map((s) => s.trim())
          .find((v) => slugify(v) === slug)
        setName(original || slug)
      } else {
        setName(slug)
      }
      setLoading(false)
    }
    load()
  }, [field, slug])

  function goToPage(nextPage) {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totalPages = Math.max(1, Math.ceil(allMatches.length / PAGE_SIZE))
  const pageMovies = allMatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <Seo
        title={`${name} — ${label}`}
        description={`Browse every movie ${label.toLowerCase() === 'actor' ? 'starring' : 'in'} ${name} on VXN.`}
      />
      <div className="container">
        <div className="section-head">
          <h2>{name}</h2>
          <Link to={backPath}>{backLabel} →</Link>
        </div>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : pageMovies.length === 0 ? (
          <div className="empty-state">No movies found for {name}.</div>
        ) : (
          <>
            <MovieGrid movies={pageMovies} />
            <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
          </>
        )}
      </div>
    </>
  )
}
