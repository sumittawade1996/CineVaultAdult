import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MOVIE_CARD_FIELDS } from '../lib/movieFields'
import { usePreload } from '../lib/preload'
import MovieGrid from '../components/MovieGrid'
import Seo from '../components/Seo'
import Pagination from '../components/Pagination'
import AdSlot from '../components/AdSlot'
import CardSkeletonGrid from '../components/CardSkeletonGrid'

const PAGE_SIZE = 20

const SORTS = {
  newest: { label: 'Newest', column: 'created_at', ascending: false },
  'top-rated': { label: 'Top rated', column: 'rating', ascending: false },
  title: { label: 'Title A–Z', column: 'title', ascending: true },
}

// PostgREST's or() filter uses commas, parens and quotes as syntax; quote
// the search term and drop the characters that could break out of it.
function searchFilter(q) {
  const safe = q.replace(/["\\]/g, '')
  const like = `ilike."%${safe}%"`
  return ['title', 'keywords', 'tags', 'actors', 'channel'].map((c) => `${c}.${like}`).join(',')
}

function scrollToTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}

export default function Movies() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') || '').trim()
  const page = Math.max(1, Number(params.get('page') || 1))
  const sortKey = SORTS[params.get('sort')] ? params.get('sort') : 'newest'
  const pre = usePreload()
  const [movies, setMovies] = useState(pre?.movies ?? [])
  const [total, setTotal] = useState(pre?.total ?? 0)
  const [loading, setLoading] = useState(!pre)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // A prerendered page already shows its data; the first fetch only
  // refreshes it quietly instead of swapping in skeletons.
  const silentRefresh = useRef(!!pre)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (silentRefresh.current) silentRefresh.current = false
      else setLoading(true)
      setError(false)
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const sort = SORTS[sortKey]

      let query = supabase
        .from('movies')
        .select(MOVIE_CARD_FIELDS, { count: 'exact' })
        .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (q) query = query.or(searchFilter(q))

      const { data, count, error: err } = await query
      if (cancelled) return
      if (err) {
        setError(true)
        setMovies([])
      } else {
        setMovies(data || [])
        setTotal(count || 0)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [q, page, sortKey, attempt])

  function updateParams(changes) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === '' || (k === 'page' && v === 1) || (k === 'sort' && v === 'newest')) next.delete(k)
      else next.set(k, String(v))
    }
    setParams(next)
  }

  function goToPage(nextPage) {
    updateParams({ page: nextPage })
    scrollToTop()
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const heading = q ? `Results for “${q}”` : 'Movies'
  const countLabel = loading ? null : `${total.toLocaleString()} ${total === 1 ? 'title' : 'titles'}`

  return (
    <>
      <Seo
        title={q ? `Search: ${q}` : 'Movies'}
        description="Browse the full VEXN movie library — trailers, ratings, genres and descriptions, updated daily."
        noindex={!!q || page > 1}
      />
      <div className="container">
        <div className="page-head">
          <div>
            <h1>{heading}</h1>
            {countLabel && (
              <p className="page-sub" aria-live="polite">
                {countLabel}
                {q && (
                  <>
                    {' · '}
                    <Link to="/movies" style={{ color: 'var(--accent)' }}>Clear search</Link>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <AdSlot slot="listingTop" />

        <div className="toolbar">
          <form
            className="search-form"
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              updateParams({ q: e.target.elements.q.value.trim(), page: 1 })
            }}
          >
            <label htmlFor="movies-q" className="sr-only">Search by title, keyword, actor, or channel</label>
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              id="movies-q"
              className="search-input"
              type="search"
              name="q"
              key={q}
              defaultValue={q}
              placeholder="Search by title, keyword, actor, or channel…"
              autoComplete="off"
            />
            <button type="submit" className="search-submit">Search</button>
          </form>

          <div className="select-wrap">
            <label htmlFor="movies-sort" className="sr-only">Sort by</label>
            <select
              id="movies-sort"
              className="select"
              value={sortKey}
              onChange={(e) => updateParams({ sort: e.target.value, page: 1 })}
            >
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <CardSkeletonGrid count={12} />
        ) : error ? (
          <div className="empty-state empty-state--error" role="alert">
            <h2>Couldn’t load movies</h2>
            <p>Something went wrong while fetching the library. Check your connection and try again.</p>
            <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
          </div>
        ) : movies.length === 0 ? (
          <div className="empty-state">
            <h2>{q ? 'No matches' : 'No movies yet'}</h2>
            <p>{q ? `Nothing matched “${q}”. Try a different title, actor or keyword.` : 'The library is empty right now.'}</p>
            {q && <Link to="/movies" className="btn btn-outline">Browse all movies</Link>}
          </div>
        ) : (
          <>
            <MovieGrid movies={movies} headingLevel="h2" />
            <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
          </>
        )}
      </div>
    </>
  )
}
