import { useState } from 'react'
import { Link } from 'react-router-dom'
import PosterPlaceholder from './PosterPlaceholder'
import { getPosterUrl } from '../lib/poster'

// `priority` marks above-the-fold cards: those posters load eagerly (the
// very first one with fetchpriority=high) so the grid's LCP image isn't
// held back by lazy-loading. Everything else stays lazy.
export default function MovieCard({ movie, priority = false, first = false, headingLevel = 'h3' }) {
  const Heading = headingLevel
  const [imgFailed, setImgFailed] = useState(false)
  const poster = imgFailed ? null : getPosterUrl(movie)

  const tags = (movie.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2)

  const meta = [movie.year, movie.runtime_minutes ? `${movie.runtime_minutes} min` : null].filter(Boolean)

  return (
    <Link to={`/movie/${movie.slug}`} className="movie-card">
      <div className="movie-poster">
        {poster ? (
          <img
            src={poster}
            alt=""
            width="640"
            height="360"
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchpriority={first ? 'high' : undefined}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <PosterPlaceholder title={movie.title} />
        )}
        {movie.rating != null && (
          <span className="badge badge-rating" aria-label={`Rated ${movie.rating} out of 10`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
            </svg>
            {movie.rating}
          </span>
        )}
        {movie.channel && <span className="badge badge-channel">{movie.channel}</span>}
      </div>
      <div className="movie-body">
        <Heading className="movie-title">{movie.title}</Heading>
        {meta.length > 0 && <p className="movie-meta">{meta.join(' · ')}</p>}
        {tags.length > 0 && (
          <div className="chip-row" aria-hidden="true">
            {tags.map((t) => (
              <span className="chip" key={t}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
