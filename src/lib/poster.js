// Poster resolution for movie cards and detail pages. A card must never
// mount a live player iframe just to show an image, so when poster_url
// is empty we try to derive a static thumbnail from the trailer URL.
// YouTube thumbnails are deterministic; Eporner posters are written
// into poster_url by scripts/backfill-posters.mjs (their API has no CORS).

export function youtubeId(url) {
  if (!url) return null
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/)
  if (m) return m[1]
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null
}

export function epornerId(url) {
  if (!url) return null
  const m = String(url).match(/eporner\.com\/(?:embed|hd-porn|video-)\/?([A-Za-z0-9]+)/)
  return m ? m[1] : null
}

export function getPosterUrl(movie) {
  if (!movie) return null
  if (movie.poster_url) return movie.poster_url
  const yt = youtubeId(movie.trailer_url)
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null
}

// Posters are hotlinked from third-party CDNs (Eporner, YouTube) that are
// slow and occasionally stall for seconds, which made them the page's LCP
// bottleneck. On Netlify they're served through Netlify Image CDN instead:
// resized, WebP, cached at Netlify's edge. The source hosts are
// allow-listed in netlify.toml. `__IMAGE_CDN__` is set in vite.config.js.
export const IMAGE_CDN = typeof __IMAGE_CDN__ !== 'undefined' && __IMAGE_CDN__

export const POSTER_WIDTHS = [320, 480, 640, 960]

export function optimizedPosterUrl(src, width) {
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}&fm=webp&q=75`
}

export function posterSrcSet(src) {
  return POSTER_WIDTHS.map((w) => `${optimizedPosterUrl(src, w)} ${w}w`).join(', ')
}
