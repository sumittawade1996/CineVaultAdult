// Shimmer placeholders shown while a grid is fetching. The boxes use the
// exact same classes/aspect ratio as a real card so nothing shifts when
// content arrives.
export default function CardSkeletonGrid({ count = 8, className = '' }) {
  return (
    <div className={`movie-grid ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="movie-card skeleton-card" key={i}>
          <div className="movie-poster skeleton-shimmer" />
          <div className="movie-body">
            <div className="skeleton-line skeleton-shimmer" style={{ width: '82%', height: 15 }} />
            <div className="skeleton-line skeleton-shimmer" style={{ width: '55%', height: 15 }} />
            <div className="skeleton-line skeleton-shimmer" style={{ width: '40%', height: 11, marginTop: 2 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
