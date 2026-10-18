import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MOVIE_CARD_FIELDS } from '../lib/movieFields'
import { usePreload } from '../lib/preload'
import { parseWeekKey, summarizeWeeks, weekLabel } from '../lib/weeks'
import { isIndexableWeek } from '../lib/indexing'
import { breadcrumbJsonLd } from '../lib/breadcrumbs'
import MovieGrid from '../components/MovieGrid'
import Seo from '../components/Seo'
import Breadcrumbs from '../components/Breadcrumbs'
import Pagination from '../components/Pagination'
import CardSkeletonGrid from '../components/CardSkeletonGrid'
import NotFound from './NotFound'

// /new          the latest additions, plus links to the weekly archives
// /new/2026-w41 everything added in that ISO week (plan T13). Generated from
//               created_at, so there is nothing to maintain by hand.
const LATEST_COUNT = 24
const PAGE_SIZE = 20
const WEEKS_SHOWN = 12

// Week counts from created_at only (a few KB), paged because one request
// returns at most 1000 rows.
async function loadWeeks() {
  const values = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('movies').select('created_at').order('created_at', { ascending: false }).range(from, from + 999)
    if (error || !data) break
    values.push(...data.map((r) => r.created_at))
    if (data.length < 1000) break
  }
  return summarizeWeeks(values).slice(0, WEEKS_SHOWN)
}

export default function NewVideos() {
  const { week } = useParams()
  const range = week ? parseWeekKey(week) : null
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') || 1))
  const pre = usePreload()
  const [movies, setMovies] = useState(pre?.movies ?? [])
  const [total, setTotal] = useState(pre?.total ?? 0)
  const [weeks, setWeeks] = useState(pre?.weeks ?? [])
  const [loading, setLoading] = useState(!pre)
  const silentRefresh = useRef(!!pre)

  useEffect(() => {
    if (week && !range) return undefined
    let cancelled = false
    async function load() {
      if (silentRefresh.current) silentRefresh.current = false
      else setLoading(true)
      let query = supabase.from('movies').select(MOVIE_CARD_FIELDS, { count: 'exact' }).order('created_at', { ascending: false })
      if (range) {
        const from = (page - 1) * PAGE_SIZE
        query = query.gte('created_at', range.start.toISOString()).lt('created_at', range.end.toISOString()).range(from, from + PAGE_SIZE - 1)
      } else {
        query = query.limit(LATEST_COUNT)
      }
      const [{ data, count }, weekList] = await Promise.all([query, loadWeeks()])
      if (cancelled) return
      setMovies(data || [])
      setTotal(range ? count || 0 : (data || []).length)
      setWeeks(weekList)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [week, page]) // eslint-disable-line react-hooks/exhaustive-deps

  function goToPage(nextPage) {
    const next = new URLSearchParams(params)
    if (nextPage === 1) next.delete('page')
    else next.set('page', String(nextPage))
    setParams(next)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  if (week && !range) {
    return <NotFound heading="Week not found" message="That week doesn’t exist. Try the latest additions." />
  }

  const label = range ? weekLabel(week) : null
  const heading = range ? `New on VEXN: ${label}` : 'New Videos'
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const crumbs = [
    { name: 'Home', to: '/' },
    { name: 'New videos', to: '/new' },
    ...(range ? [{ name: label, to: `/new/${week}` }] : []),
  ]
  const description = range
    ? `${total.toLocaleString()} ${total === 1 ? 'video' : 'videos'} added to VEXN in the week of ${label}, newest first, with the cast, tags and runtime for each.`
    : 'The latest videos added to VEXN, newest first, with a weekly archive of every earlier addition. Each video lists its cast, tags and runtime.'

  return (
    <>
      <Seo
        title={range ? `New Videos, ${label}` : 'New Videos – Latest Additions'}
        description={description}
        noindex={!!range && (page > 1 || (!loading && !isIndexableWeek(total)))}
        jsonLd={breadcrumbJsonLd(crumbs)}
      />
      <div className="container">
        <Breadcrumbs items={crumbs} />
        <div className="page-head">
          <div>
            <h1>{heading}</h1>
            {!loading && (
              <p className="page-sub">
                {range
                  ? `${total.toLocaleString()} ${total === 1 ? 'title' : 'titles'} added this week`
                  : `The ${movies.length} most recent additions`}
              </p>
            )}
          </div>
          <Link to="/movies" className="btn btn-outline btn-sm">All movies →</Link>
        </div>

        {weeks.length > 0 && (
          <nav className="chip-row" style={{ marginBottom: 20 }} aria-label="Weekly archive">
            {!range && <span className="chip chip--active" aria-current="page">Latest</span>}
            {range && <Link to="/new" className="chip">Latest</Link>}
            {weeks.map((w) =>
              w.key === week ? (
                <span className="chip chip--active" key={w.key} aria-current="page">{w.label} ({w.count})</span>
              ) : (
                <Link to={`/new/${w.key}`} className="chip" key={w.key}>{w.label} ({w.count})</Link>
              )
            )}
          </nav>
        )}

        {loading ? (
          <CardSkeletonGrid count={12} />
        ) : movies.length === 0 ? (
          <div className="empty-state">
            <h2>Nothing added this week</h2>
            <p>Pick another week above, or browse the full library.</p>
            <Link to="/movies" className="btn btn-outline">Browse all movies</Link>
          </div>
        ) : (
          <>
            <MovieGrid movies={movies} headingLevel="h2" />
            {range && <Pagination page={page} totalPages={totalPages} onChange={goToPage} />}
          </>
        )}
      </div>
    </>
  )
}
