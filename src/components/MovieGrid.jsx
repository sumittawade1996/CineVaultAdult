import MovieCard from './MovieCard'
import AdSlot from './AdSlot'
import { useIsMobile } from '../lib/useIsMobile'

// How many leading cards count as above-the-fold. Two mobile rows / one
// desktop row is enough to cover the LCP candidate on every viewport.
const EAGER_COUNT = 4

// The in-feed ad is a full-width row inside the grid. It sits after a
// whole number of rows and beneath the first viewport on both phone and
// desktop layouts: the native ad's image is otherwise the largest thing
// on screen and the ad network delivers it seconds after everything
// else, which would make it the page's LCP element.
const AD_AFTER_MOBILE = 6
const AD_AFTER_DESKTOP = 12

export default function MovieGrid({ movies, adAfter, eager = true, className = '', headingLevel = 'h3' }) {
  const isMobile = useIsMobile()
  if (!movies || movies.length === 0) return null

  const breakAt = adAfter ?? (isMobile ? AD_AFTER_MOBILE : AD_AFTER_DESKTOP)
  const showAd = movies.length > breakAt

  const children = movies.map((m, i) => (
    <MovieCard
      key={m.id}
      movie={m}
      priority={eager && i < EAGER_COUNT}
      first={eager && i === 0}
      headingLevel={headingLevel}
    />
  ))
  if (showAd) children.splice(breakAt, 0, <AdSlot key="in-feed-ad" slot="inFeed" className="movie-grid-ad" />)

  return <div className={`movie-grid ${className}`.trim()}>{children}</div>
}
