import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { forgetWatchHistory, INDIAN_SHORTCUT } from '../lib/watchHistory'

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
    </svg>
  )
}

// The same "Watch Indian movies" button for every visitor (no "Continue watching" or "More <favourite>" buttons).
// variant "nav"    -> one button in the desktop header
// variant "mobile" -> one compact pill in the phone header
// variant "hero"   -> the button under the homepage heading
export default function WatchShortcut({ variant = 'nav' }) {
  const s = INDIAN_SHORTCUT
  // clears the record the earlier, personalised version left in the visitor's browser
  useEffect(() => { forgetWatchHistory() }, [])

  if (variant === 'hero') {
    return (
      <div className="watch-row" aria-label="Quick watch">
        <Link to={s.to} className="btn watch-btn" data-kind={s.kind}>
          <PlayIcon />
          <span className="watch-btn-text">{s.label}</span>
        </Link>
      </div>
    )
  }

  const mobile = variant === 'mobile'
  return (
    <Link
      to={s.to}
      className={`btn btn-sm ${mobile ? 'nav-watch-mobile' : 'nav-watch'}`}
      data-kind={s.kind}
      title={s.label}
      aria-label={s.label}
    >
      <PlayIcon />
      {mobile ? s.short : s.label}
    </Link>
  )
}
