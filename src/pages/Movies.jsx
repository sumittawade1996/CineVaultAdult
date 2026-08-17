import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import MovieGrid from '../components/MovieGrid'
import Seo from '../components/Seo'
import Pagination from '../components/Pagination'
import AdSlot from '../components/AdSlot'
import CardSkeletonGrid from '../components/CardSkeletonGrid'

const PAGE_SIZE = 20

export default function Movies() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const page = Math.max(1, Number(params.get('page') || 1))
  const [movies, setMovies] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('movies')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (q) {
        query = query.or(
          `title.ilike.%${q}%,keywords.ilike.%${q}%,tags.ilike.%${q}%,actors.ilike.%${q}%,channel.ilike.%${q}%`
        )
      }

      const { data, count } = await query
      setMovies(data || [])
      setTotal(count || 0)
      setLoading(false)
    }
    load()
  }, [q, page])

  function goToPage(nextPage) {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <Seo title="Movies" description="Browse the full VXN movie library — trailers, ratings, genres, and descriptions." />
      <div className="container">
        <div className="section-head">
          <h2>{q ? `Results for "${q}"` : 'All movies'}</h2>
        </div>

        <AdSlot slot="listingTop" />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const val = e.target.elements.q.value.trim()
            setParams(val ? { q: val } : {})
          }}
          style={{ marginBottom: 24 }}
        >
          <input
            className="nav-search"
            style={{ width: '100%', maxWidth: 360 }}
            name="q"
            defaultValue={q}
            placeholder="Search by title, keyword, actor, or channel…"
          />
        </form>

        {loading ? (
          <CardSkeletonGrid count={12} />
        ) : movies.length === 0 ? (
          <div className="empty-state">No movies match that search.</div>
        ) : (
          <>
            <MovieGrid movies={movies} />
            <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
          </>
        )}
      </div>
    </>
  )
}
