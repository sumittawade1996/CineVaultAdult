import MovieCard from './MovieCard'
import AdSlot from './AdSlot'

// Renders a movie grid with a native in-feed ad slot inserted right
// after the 4th card (only when there are more than 4 movies to show).
export default function MovieGrid({ movies, adAfter = 4 }) {
  if (!movies || movies.length === 0) return null

  const showAd = movies.length > adAfter
  const firstChunk = showAd ? movies.slice(0, adAfter) : movies
  const restChunk = showAd ? movies.slice(adAfter) : []

  return (
    <>
      <div className="movie-grid">
        {firstChunk.map((m) => <MovieCard key={m.id} movie={m} />)}
      </div>
      {showAd && (
        <>
          <AdSlot slot="inFeed" />
          <div className="movie-grid">
            {restChunk.map((m) => <MovieCard key={m.id} movie={m} />)}
          </div>
        </>
      )}
    </>
  )
}
