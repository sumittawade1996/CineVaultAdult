import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import { MOVIE_CARD_FIELDS } from '../lib/movieFields'
import { usePreload } from '../lib/preload'
import MovieGrid from '../components/MovieGrid'
import Seo from '../components/Seo'
import Pagination from '../components/Pagination'
import CardSkeletonGrid from '../components/CardSkeletonGrid'

const PAGE_SIZE = 20

// Cards don't need the actors column, but the actor pages filter on it.
export const TAXONOMY_FIELDS = `${MOVIE_CARD_FIELDS},actors`

export function matchesSlug(movie, field, slug) {
  return (movie[field] || '')
    .split(',')
    .map((s) => s.trim())
    .some((v) => v && slugify(v) === slug)
}

export function displayName(movie, field, slug) {
  return (movie[field] || '')
    .split(',')
    .map((s) => s.trim())
    .find((v) => slugify(v) === slug)
}

export default function TaxonomyDetail({ field, label, backPath, backLabel }) {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') || 1))
  const pre = usePreload()
  const [allMatches, setAllMatches] = useState(pre?.allMatches ?? [])
  const [name, setName] = useState(pre?.name ?? '')
  const [loading, setLoading] = useState(!pre)
  const silentRefresh = useRef(!!pre)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (silentRefresh.current) silentRefresh.current = false
      else setLoading(true)
      // Fetch broadly, then filter client-side by matching slug — comma
      // fields (actors/tags) can't be exact-matched in SQL reliably.
      const { data } = await supabase
        .from('movies')
        .select(TAXONOMY_FIELDS)
        .order('created_at', { ascending: false })
      if (cancelled) return
      const matches = (data || []).filter((m) => matchesSlug(m, field, slug))
      setAllMatches(matches)
      setName((matches.length > 0 && displayName(matches[0], field, slug)) || slug)
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
