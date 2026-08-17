// Shown in place of a poster/thumbnail image when no poster_url is set,
// so cards never render as an empty box.
export default function PosterPlaceholder({ title }) {
  const initial = (title || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="poster-placeholder" aria-hidden="true">
      <svg viewBox="0 0 48 48" className="poster-placeholder-icon" fill="none">
        <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M4 16h40" stroke="currentColor" strokeWidth="2" />
        <path d="M13 8v8M19 8v8M29 8v8M35 8v8" stroke="currentColor" strokeWidth="2" />
        <path d="M20 24l9 5-9 5v-10z" fill="currentColor" />
      </svg>
      <span className="poster-placeholder-letter">{initial}</span>
    </div>
  )
}
