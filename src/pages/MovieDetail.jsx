import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import { toEmbedUrl } from '../lib/video'
import { isAdminAuthed } from '../lib/adminAuth'
import Seo from '../components/Seo'
import AdSlot from '../components/AdSlot'
import MovieCard from '../components/MovieCard'
import PosterPlaceholder from '../components/PosterPlaceholder'
import { FALLBACK_SITE_URL } from '../lib/siteConfig'

export default function MovieDetail() {
  const { slug } = useParams()
  const [movie, setMovie] = useState(null)
  const [related, setRelated] = useState([])
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('movies').select('*').eq('slug', slug).single()
      if (!data) {
        setNotFound(true)
        return
      }
      setMovie(data)
      const firstTag = (data.tags || '').split(',')[0]?.trim()
      if (firstTag) {
        const { data: rel } = await supabase
          .from('movies')
          .select('*')
          .ilike('tags', `%${firstTag}%`)
          .neq('id', data.id)
          .limit(4)
        setRelated(rel || [])
      }
    }
    load()
  }, [slug])

  if (notFound) {
    return (
      <div className="container empty-state">
        Movie not found. <Link to="/movies">Back to all movies →</Link>
      </div>
    )
  }
  if (!movie) {
    return (
      <div className="container" style={{ padding: '48px 0' }}>
        <div className="detail-hero skeleton-detail-hero">
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

  const tags = (movie.tags || '').split(',').map((t) => t.trim()).filter(Boolean)
  const actors = (movie.actors || '').split(',').map((t) => t.trim()).filter(Boolean)
  const embedUrl = toEmbedUrl(movie.trailer_url)
  const siteUrl = (typeof window !== 'undefined' ? window.location.origin : FALLBACK_SITE_URL).replace(/\/$/, '')

  const movieJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    description: movie.description || movie.seo_description || undefined,
    image: movie.poster_url || undefined,
    datePublished: movie.year ? String(movie.year) : undefined,
    duration: movie.runtime_minutes ? `PT${movie.runtime_minutes}M` : undefined,
    aggregateRating:
      movie.rating != null
        ? { '@type': 'AggregateRating', ratingValue: movie.rating, bestRating: 10 }
        : undefined,
    actor: actors.length ? actors.map((name) => ({ '@type': 'Person', name })) : undefined,
    genre: tags.length ? tags : undefined,
    url: `${siteUrl}/movie/${movie.slug}`,
  }

  return (
    <>
      <Seo
        title={movie.seo_title || movie.title}
        description={movie.seo_description || movie.description}
        image={movie.poster_url}
        type="video.movie"
        jsonLd={movieJsonLd}
      />
      <div className="container">
        <div className="detail-hero">
          <div>
            <div className="detail-poster">
              {movie.poster_url ? (
                <img src={movie.poster_url} alt={`${movie.title} poster`} width="420" height="240" />
              ) : (
                <PosterPlaceholder title={movie.title} />
              )}
            </div>
            <AdSlot slot="detailSidebar" className="detail-sidebar-ad" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <h1 className="detail-title">{movie.title}</h1>
              {isAdminAuthed() && (
                <Link
                  to={`/admin/movie?slug=${movie.slug}`}
                  className="btn btn-outline"
                  style={{ flexShrink: 0, fontSize: 13, padding: '6px 14px' }}
                >
                  Edit movie
                </Link>
              )}
            </div>
            <div className="detail-meta">
              {movie.year && <span>{movie.year}</span>}
              {movie.runtime_minutes && <span>{movie.runtime_minutes} min</span>}
              {movie.rating != null && <span>★ {movie.rating}</span>}
              {movie.channel && (
                <Link to={`/channel/${slugify(movie.channel)}`} style={{ color: 'var(--gold)' }}>
                  {movie.channel}
                </Link>
              )}
            </div>
            <p className="detail-desc">{movie.description}</p>
            {tags.length > 0 && (
              <div className="ticket-tags">
                {tags.map((t) => (
                  <Link to={`/category/${slugify(t)}`} className="tag-chip" key={t}>{t}</Link>
                ))}
              </div>
            )}
            {actors.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="hero-eyebrow" style={{ marginBottom: 8 }}>Cast</div>
                <div className="ticket-tags">
                  {actors.map((a) => (
                    <Link to={`/actor/${slugify(a)}`} className="tag-chip" key={a}>{a}</Link>
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
              </div>
            )}
          </div>
        </div>

        <AdSlot slot="belowTrailer" />

        {related.length > 0 && (
          <>
            <AdSlot slot="aboveRelated" />
            <div className="section-head"><h2>You might also like</h2></div>
            <div className="movie-grid">
              {related.map((m) => <MovieCard key={m.id} movie={m} />)}
            </div>
          </>
        )}
      </div>
    </>
  )
}
