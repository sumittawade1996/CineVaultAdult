import MovieCard from './MovieCard'
import AdSlot from './AdSlot'

// How many leading cards count as above-the-fold. Two mobile rows / one
// desktop row is enough to cover the LCP candidate on every viewport.
const EAGER_COUNT = 4

// The in-feed ad is a full-width row inside the grid, placed beneath the
// first viewport so the ad network's late-arriving image never becomes
// the page's LCP element. It sits after 6 cards in the DOM (three phone
// rows); index.css moves it after 12 cards on wider screens with CSS
// `order`, and hides it there when the grid is too short — done in CSS
// so the prerendered HTML is identical for every viewport.
const AD_AFTER_PHONE = 6
const AD_AFTER_DESKTOP = 12

export default function MovieGrid({ movies, ad = true, eager = true, featured = false, className = '', headingLevel = 'h3' }) {
  if (!movies || movies.length === 0) return null

  const children = movies.map((m, i) => (
    <MovieCard
      key={m.id}
      movie={m}
      priority={eager && i < EAGER_COUNT}
      first={eager && i === 0}
      headingLevel={headingLevel}
      featured={featured}
    />
  ))
  if (ad && movies.length > AD_AFTER_PHONE) {
    const phoneOnly = movies.length <= AD_AFTER_DESKTOP ? ' movie-grid-ad--phone-only' : ''
    children.splice(AD_AFTER_PHONE, 0, <AdSlot key="in-feed-ad" slot="inFeed" className={`movie-grid-ad${phoneOnly}`} />)
  }

  return <div className={`movie-grid ${className}`.trim()}>{children}</div>
}
