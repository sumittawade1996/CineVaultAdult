import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MOVIE_CARD_FIELDS } from '../lib/movieFields'
import { trackNotFound } from '../lib/analytics'
import Seo from '../components/Seo'
import MovieGrid from '../components/MovieGrid'
import CardSkeletonGrid from '../components/CardSkeletonGrid'

// Shown for unknown routes and for movies that no longer exist. Always
// `noindex`; the edge function (netlify/edge-functions/movie-gate.js) also
// sends a real 404/410 status for removed or unknown movie URLs. The six
// featured videos under the search box give a visitor who landed on a dead
// link something to click instead of leaving.
const POPULAR = [
  ['Indian', '/category/indian'],
  ['Desi', '/category/desi'],
  ['Bhabhi', '/category/bhabhi'],
  ['MILF', '/category/milf'],
  ['Lesbian', '/category/lesbian'],
  ['Massage', '/category/massage'],
  ['4K', '/category/4k'],
]

export default function NotFound({
  heading = 'Reel missing',
  message = "That page doesn't exist or has been removed.",
}) {
  const navigate = useNavigate()
  // null = still loading; [] = none to show (the section is then hidden)
  const [featured, setFeatured] = useState(null)

  // Count dead-URL hits (a row with status_code 404 in page_views).
  useEffect(() => { trackNotFound() }, [])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('movies')
      .select(MOVIE_CARD_FIELDS)
      .eq('featured', true)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { if (!cancelled) setFeatured(data || []) })
    return () => { cancelled = true }
  }, [])

  function onSearch(e) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')?.toString().trim()
    navigate(q ? `/movies?q=${encodeURIComponent(q)}` : '/movies')
  }

  return (
    <>
      <Seo title="Page not found" description="This page doesn't exist on VEXN." noindex />
      <div className="container empty-state" style={{ padding: '64px 0', marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>{heading}</h2>
        <p>{message}</p>

        <form className="search-form" role="search" onSubmit={onSearch} style={{ margin: '20px auto 0' }}>
          <label htmlFor="nf-q" className="sr-only">Search movies</label>
          <input
            id="nf-q"
            className="search-input"
            type="search"
            name="q"
            placeholder="Search movies…"
            autoComplete="off"
            style={{ paddingLeft: 18 }}
          />
          <button type="submit" className="search-submit" aria-label="Search">Search</button>
        </form>

        <p style={{ marginTop: 22 }}>Popular right now</p>
        <div className="chip-row" style={{ justifyContent: 'center' }}>
          {POPULAR.map(([label, to]) => (
            <Link key={to} to={to} className="chip">{label}</Link>
          ))}
        </div>

        <p style={{ marginTop: 22 }}>
          <Link to="/movies" style={{ color: 'var(--gold)' }}>Newest movies →</Link>
          {' · '}
          <Link to="/articles" style={{ color: 'var(--gold)' }}>Articles →</Link>
          {' · '}
          <Link to="/" style={{ color: 'var(--gold)' }}>Home →</Link>
        </p>
      </div>

      {(featured === null || featured.length > 0) && (
        <div className="container">
          <div className="section-head">
            <h2>Featured right now</h2>
            <Link to="/movies">View all →</Link>
          </div>
          {featured === null ? (
            <CardSkeletonGrid count={6} className="movie-grid--featured" />
          ) : (
            <MovieGrid movies={featured} ad={false} eager={false} featured className="movie-grid--featured" />
          )}
        </div>
      )}
    </>
  )
}
