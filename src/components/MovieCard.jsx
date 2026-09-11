import { useState } from 'react'
import { Link } from 'react-router-dom'
import PosterPlaceholder from './PosterPlaceholder'
import { getPosterUrl, IMAGE_CDN, optimizedPosterUrl, posterSrcSet } from '../lib/poster'

// Card widths across the breakpoints in index.css, so the browser can pick
// the smallest optimized poster that still fills the box on its DPR.
const CARD_SIZES = '(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 240px'
const FEATURED_SIZES = '(max-width: 640px) 46vw, (max-width: 1024px) 48vw, 440px'

// `priority` marks above-the-fold cards: those posters load eagerly (the
// very first one with fetchpriority=high) so the grid's LCP image isn't
// held back by lazy-loading. Everything else stays lazy.
export default function MovieCard({ movie, priority = false, first = false, headingLevel = 'h3', featured = false }) {
  const Heading = headingLevel
  // 0 = optimized via Image CDN, 1 = original URL, 2 = placeholder
  const [stage, setStage] = useState(0)
  const original = getPosterUrl(movie)
  const useCdn = stage === 0 && original && IMAGE_CDN
  const poster = stage === 2 ? null : original

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
            src={useCdn ? optimizedPosterUrl(poster, 480) : poster}
            srcSet={useCdn ? posterSrcSet(poster) : undefined}
            sizes={useCdn ? (featured ? FEATURED_SIZES : CARD_SIZES) : undefined}
            alt=""
            width="640"
            height="360"
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchpriority={first ? 'high' : undefined}
            onError={() => setStage(useCdn ? 1 : 2)}
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
