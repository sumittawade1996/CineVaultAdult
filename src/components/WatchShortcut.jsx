import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getShortcuts, INDIAN_SHORTCUT } from '../lib/watchHistory'

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
    </svg>
  )
}

// Server render and first client render both show the Indian shortcut, so
// hydration matches; the visitor's own history (if any) swaps in right after.
function useShortcuts() {
  const { pathname } = useLocation()
  const [items, setItems] = useState([INDIAN_SHORTCUT])
  useEffect(() => {
    const refresh = () => setItems(getShortcuts())
    refresh()
    window.addEventListener('vexn-watch', refresh)
    return () => window.removeEventListener('vexn-watch', refresh)
  }, [pathname])
  return items
}

// variant "nav"    -> one button in the desktop header
// variant "mobile" -> one compact pill in the phone header
// variant "hero"   -> the full row under the homepage heading
export default function WatchShortcut({ variant = 'nav' }) {
  const items = useShortcuts()

  if (variant === 'hero') {
    return (
      <div className="watch-row" aria-label="Quick watch">
        {items.map((s, i) => (
          <Link key={s.to} to={s.to} className={`btn watch-btn${i === 0 ? '' : ' btn-outline'}`} data-kind={s.kind}>
            <PlayIcon />
            <span className="watch-btn-text">
              {s.label}
              {s.sub && <small>{s.sub}</small>}
            </span>
          </Link>
        ))}
      </div>
    )
  }

  const s = items[0]
  const mobile = variant === 'mobile'
  return (
    <Link
      to={s.to}
      className={`btn btn-sm ${mobile ? 'nav-watch-mobile' : 'nav-watch'}`}
      data-kind={s.kind}
      title={s.sub || s.label}
      aria-label={s.sub ? `${s.label}: ${s.sub}` : s.label}
    >
      <PlayIcon />
      {mobile ? s.short : s.label}
    </Link>
  )
}
