// Lightweight shimmer placeholders shown while movies/articles are
// fetching, instead of a bare "Loading…" line. Keeps layout stable
// (no jump when real cards arrive) and feels faster to the visitor.
export default function CardSkeletonGrid({ count = 8 }) {
  return (
    <div className="movie-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="ticket-card skeleton-card" key={i}>
          <div className="ticket-poster skeleton-shimmer" />
          <div className="ticket-perf" />
          <div className="ticket-info">
            <div className="skeleton-line skeleton-shimmer" style={{ width: '70%', height: 16 }} />
            <div className="skeleton-line skeleton-shimmer" style={{ width: '40%', height: 12 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
