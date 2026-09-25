import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import { toEmbedUrl } from '../lib/video'
import { getPosterUrl, IMAGE_CDN, optimizedPosterUrl, posterSrcSet } from '../lib/poster'
import { MOVIE_CARD_FIELDS } from '../lib/movieFields'
import { isAdminAuthed } from '../lib/adminAuth'
import { usePreload } from '../lib/preload'
import Seo from '../components/Seo'
import AdSlot from '../components/AdSlot'
import MovieGrid from '../components/MovieGrid'
import PosterPlaceholder from '../components/PosterPlaceholder'
import { FALLBACK_SITE_URL } from '../lib/siteConfig'

const DETAIL_SIZES = '(max-width: 860px) 100vw, 640px'

export default function MovieDetail() {
  const { slug } = useParams()
  const pre = usePreload()
  const [movie, setMovie] = useState(pre?.movie ?? null)
  const [related, setRelated] = useState(pre?.related ?? [])
  const [notFound, setNotFound] = useState(false)
  // 0 = optimized via Image CDN, 1 = original URL, 2 = placeholder
  const [posterStage, setPosterStage] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const silentRefresh = useRef(!!pre)

  useEffect(() => { setIsAdmin(isAdminAuthed()) }, [])

  useEffect(() => {
    let cancelled = false
    if (silentRefresh.current) {
      silentRefresh.current = false
    } else {
      setMovie(null)
      setRelated([])
      setNotFound(false)
      setPosterStage(0)
    }
    async function load() {
      const { data } = await supabase.from('movies').select('*').eq('slug', slug).single()
      if (cancelled) return
      if (!data) {
        setNotFound(true)
        return
      }
      setMovie(data)
      const firstTag = (data.tags || '').split(',')[0]?.trim()
      if (firstTag) {
        const { data: rel } = await supabase
          .from('movies')
          .select(MOVIE_CARD_FIELDS)
          .ilike('tags', `%${firstTag}%`)
          .neq('id', data.id)
          .order('created_at', { ascending: false })
          .limit(4)
        if (!cancelled) setRelated(rel || [])
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  // Hooks must run unconditionally on every render, so these are computed
  // before the early returns below (guarded with movie?.) even though
  // they're only meaningful once a movie has loaded.
  const tags = useMemo(() => (movie?.tags || '').split(',').map((t) => t.trim()).filter(Boolean), [movie?.tags])
  const actors = useMemo(() => (movie?.actors || '').split(',').map((t) => t.trim()).filter(Boolean), [movie?.actors])
  const embedUrl = useMemo(() => toEmbedUrl(movie?.trailer_url), [movie?.trailer_url])
  const original = useMemo(() => getPosterUrl(movie), [movie])

  // VideoObject (not Movie) is the schema Google expects for tube-style video
  // pages — it's what makes the page eligible for video rich results
  // (duration/thumbnail in search), which Movie schema doesn't grant here.
  // Memoized: only needs to change when the movie itself changes, not on
  // every render (e.g. poster-fallback state updates).
  const movieJsonLd = useMemo(() => movie ? ({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: movie.title,
    description: movie.description || movie.seo_description || movie.title,
    thumbnailUrl: original || undefined,
    uploadDate: movie.created_at || undefined,
    duration: movie.runtime_minutes ? `PT${movie.runtime_minutes}M` : undefined,
    embedUrl: embedUrl || undefined,
    aggregateRating:
      movie.rating != null
        ? { '@type': 'AggregateRating', ratingValue: movie.rating, bestRating: 10 }
        : undefined,
    actor: actors.length ? actors.map((name) => ({ '@type': 'Person', name })) : undefined,
    genre: tags.length ? tags : undefined,
    url: `${FALLBACK_SITE_URL}/movie/${movie.slug}`,
  }) : null, [movie, original, embedUrl, actors, tags])

  if (notFound) {
    return (
      <div className="container" style={{ padding: '48px 0' }}>
        <div className="empty-state">
          <h2>Movie not found</h2>
          <p>That title isn’t in the library (it may have been removed).</p>
          <Link to="/movies" className="btn btn-outline">Back to all movies</Link>
        </div>
      </div>
    )
  }
  if (!movie) {
    return (
      <div className="container">
        <div className="detail-hero skeleton-detail-hero" aria-hidden="true">
          <div className="detail-poster skeleton-shimmer" />
          <div>
            <div className="skeleton-line skeleton-shimmer" style={{ width: '60%', height: 34, marginBottom: 16 }} />
            <div className="skeleton-line skeleton-shimmer" style={{ width: '30%', height: 16, marginBottom: 20 }} />
            <div className="skeleton-line skeleton-shimmer" style={{ width: '90%', height: 14, marginBottom: 8 }} />
            <div className="skeleton-line skeleton-shimmer" style={{ width: '80%', height: 14 }} />
          </div>
        </div>
      </div>
    )
  }

  const useCdn = posterStage === 0 && original && IMAGE_CDN
  const poster = posterStage === 2 ? null : original

  return (
    <>
      <Seo
        title={movie.seo_title || movie.title}
        description={movie.seo_description || movie.description}
        image={original}
        type="video.movie"
        jsonLd={movieJsonLd}
      />
      <div className="container">
        <div className="detail-hero">
          <div>
            <div className="detail-poster">
              {poster ? (
                <img
                  src={useCdn ? optimizedPosterUrl(poster, 960) : poster}
                  srcSet={useCdn ? posterSrcSet(poster) : undefined}
                  sizes={useCdn ? DETAIL_SIZES : undefined}
                  alt={`${movie.title} poster`}
                  width="640"
                  height="360"
                  fetchpriority="high"
                  decoding="async"
                  onError={() => setPosterStage(useCdn ? 1 : 2)}
                />
              ) : (
                <PosterPlaceholder title={movie.title} />
              )}
            </div>
            <AdSlot slot="detailSidebar" className="detail-sidebar-ad" />
          </div>
          <div>
            <div className="detail-title-row">
              <h1 className="detail-title">{movie.title}</h1>
              {isAdmin && (
                <Link to={`/admin/movie?slug=${movie.slug}`} className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>
                  Edit movie
                </Link>
              )}
            </div>
            <div className="detail-meta">
              {movie.year && <span>{movie.year}</span>}
              {movie.runtime_minutes && <span>{movie.runtime_minutes} min</span>}
              {movie.rating != null && <span aria-label={`Rated ${movie.rating} out of 10`}>★ {movie.rating}</span>}
              {movie.channel && (
                <Link to={`/channel/${slugify(movie.channel)}`} style={{ color: 'var(--accent)' }}>
                  {movie.channel}
                </Link>
              )}
            </div>
            {movie.description && <p className="detail-desc">{movie.description}</p>}
            {tags.length > 0 && (
              <div className="chip-row">
                {tags.map((t) => (
                  <Link to={`/category/${slugify(t)}`} className="chip" key={t}>{t}</Link>
                ))}
              </div>
            )}
            {actors.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="hero-eyebrow" style={{ marginBottom: 8 }}>Cast</div>
                <div className="chip-row">
                  {actors.map((a) => (
                    <Link to={`/actor/${slugify(a)}`} className="chip" key={a}>{a}</Link>
                  ))}
                </div>
              </div>
            )}
            {embedUrl && (
              <div className="trailer-frame">
                <iframe
                  width="100%"
                  height="100%"
                  src={embedUrl}
                  title={`${movie.title} trailer`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <div className="trailer-frame-shield" aria-hidden="true" />
                <AdSlot slot="playerOverlay" />
              </div>
            )}
          </div>
        </div>

        <AdSlot slot="belowTrailer" />

        {related.length > 0 && (
          <>
            <AdSlot slot="aboveRelated" />
            <div className="section-head"><h2>You might also like</h2></div>
            <MovieGrid movies={related} ad={false} eager={false} />
          </>
        )}
      </div>
    </>
  )
}
