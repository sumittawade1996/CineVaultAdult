// Converts a trailer link (YouTube watch URL, share URL, bare video ID,
// Vimeo, or an already-ready /embed/ URL) into a URL safe to drop into an
// <iframe src>. Shared by MovieCard (grid preview) and MovieDetail (full
// trailer player) so both stay in sync.
export function toEmbedUrl(url) {
  if (!url) return null
  const trimmed = url.trim()

  // Already a ready-to-embed URL from ANY provider (YouTube, Vimeo, or
  // any other host that gives you an /embed/... iframe src) — use it
  // as-is. Don't rewrite the domain.
  if (/\/embed\//i.test(trimmed) || /player\.vimeo\.com/i.test(trimmed)) {
    return trimmed
  }

  // A plain YouTube watch/share link — convert to YouTube's embed URL
  const idMatch = trimmed.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
  if (idMatch) return `https://www.youtube.com/embed/${idMatch[1]}`

  // A bare 11-character YouTube video ID with nothing else
  if (/^[\w-]{11}$/.test(trimmed)) return `https://www.youtube.com/embed/${trimmed}`

  // Fallback: use whatever was given, unmodified
  return trimmed
}
