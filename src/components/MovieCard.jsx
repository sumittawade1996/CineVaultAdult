import { Link } from 'react-router-dom'
import PosterPlaceholder from './PosterPlaceholder'
import { toEmbedUrl } from '../lib/video'

export default function MovieCard({ movie }) {
  const tags = (movie.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3)

  const embedUrl = !movie.poster_url ? toEmbedUrl(movie.trailer_url) : null

  return (
    <Link to={`/movie/${movie.slug}`} className="ticket-card">
      <div className="ticket-poster">
        {movie.poster_url ? (
          <img src={movie.poster_url} alt={`${movie.title} poster`} loading="lazy" width="420" height="240" />
        ) : embedUrl ? (
          <iframe
            className="ticket-poster-video"
            src={embedUrl}
            title={`${movie.title} trailer preview`}
            loading="lazy"
            frameBorder="0"
            allow="encrypted-media; picture-in-picture"
            tabIndex={-1}
          />
        ) : (
          <PosterPlaceholder title={movie.title} />
        )}
        {movie.rating != null && <span className="ticket-rating">★ {movie.rating}</span>}
        {movie.channel && <span className="ticket-channel">{movie.channel}</span>}
      </div>
      <div className="ticket-perf" />
      <div className="ticket-info">
        <h3>{movie.title}</h3>
        <div className="ticket-meta">
          {movie.year && <span>{movie.year}</span>}
          {movie.runtime_minutes && <span>{movie.runtime_minutes}m</span>}
        </div>
        {tags.length > 0 && (
          <div className="ticket-tags">
            {tags.map((t) => (
              <span className="tag-chip" key={t}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
