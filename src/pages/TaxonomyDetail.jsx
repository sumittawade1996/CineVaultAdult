import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import { MOVIE_CARD_FIELDS } from '../lib/movieFields'
import MovieGrid from '../components/MovieGrid'
import Seo from '../components/Seo'
import Pagination from '../components/Pagination'
import CardSkeletonGrid from '../components/CardSkeletonGrid'

const PAGE_SIZE = 20

export default function TaxonomyDetail({ field, label, backPath, backLabel }) {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') || 1))
  const [allMatches, setAllMatches] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      // Fetch broadly, then filter client-side by matching slug — comma
      // fields (actors/tags) can't be exact-matched in SQL reliably.
      const { data } = await supabase
        .from('movies')
        .select(MOVIE_CARD_FIELDS)
        .order('created_at', { ascending: false })
      if (cancelled) return
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
    return () => { cancelled = true }
  }, [field, slug])

  function goToPage(nextPage) {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  const totalPages = Math.max(1, Math.ceil(allMatches.length / PAGE_SIZE))
  const pageMovies = allMatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <Seo
        title={`${name} — ${label}`}
        description={`Browse every movie ${label.toLowerCase() === 'actor' ? 'starring' : 'in'} ${name} on VEXN.`}
        noindex={page > 1}
      />
      <div className="container">
        <div className="page-head">
          <div>
            <h1>{name}</h1>
            {!loading && (
              <p className="page-sub">
                {allMatches.length.toLocaleString()} {allMatches.length === 1 ? 'title' : 'titles'}
              </p>
            )}
          </div>
          <Link to={backPath} className="btn btn-outline btn-sm">{backLabel} →</Link>
        </div>
        {loading ? (
          <CardSkeletonGrid count={8} />
        ) : pageMovies.length === 0 ? (
          <div className="empty-state">
            <h2>No movies found</h2>
            <p>Nothing is filed under “{name}” yet.</p>
            <Link to={backPath} className="btn btn-outline">{backLabel}</Link>
          </div>
        ) : (
          <>
            <MovieGrid movies={pageMovies} headingLevel="h2" />
            <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
          </>
        )}
      </div>
    </>
  )
}
