import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import ActiveUsers from './ActiveUsers'
import { SOCIAL_LINKS } from '../lib/siteConfig'

const NAV = [
  { to: '/movies', label: 'Movies' },
  { to: '/actors', label: 'Actors' },
  { to: '/channels', label: 'Channels' },
  { to: '/categories', label: 'Categories' },
  { to: '/articles', label: 'Articles' },
]

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

function Social({ className }) {
  return (
    <>
      <a href={SOCIAL_LINKS.twitter} target="_blank" rel="noopener noreferrer" aria-label="Follow on X (Twitter)" className={className}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7.1l-5.5-7.2L4.4 22H1.3l8.2-9.3L1 2h7.3l5 6.6L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z" />
        </svg>
      </a>
      <a href={SOCIAL_LINKS.telegram} target="_blank" rel="noopener noreferrer" aria-label="Join on Telegram" className={className}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21.9 4.6 18.6 20.3c-.25 1.1-.9 1.38-1.83.86l-5.06-3.73-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.15L18 6.1c.4-.36-.09-.56-.62-.2L6.7 12.9l-4.98-1.56c-1.08-.34-1.1-1.08.23-1.6L20.5 3.15c.9-.33 1.68.2 1.4 1.45Z" />
        </svg>
      </a>
    </>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function onSearch(e) {
    e.preventDefault()
    const q = e.target.elements.q.value.trim()
    navigate(q ? `/movies?q=${encodeURIComponent(q)}` : '/movies')
  }

  return (
    <header className="navbar">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="container navbar-inner">
        <Link to="/" className="brand" aria-label="VEXN home">
          VEX<span>N</span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <form className="nav-search-form" role="search" onSubmit={onSearch}>
          <label htmlFor="nav-q" className="sr-only">Search movies</label>
          <input id="nav-q" className="nav-search" type="search" name="q" placeholder="Search movies…" autoComplete="off" />
          <button type="submit" className="nav-search-btn" aria-label="Search">
            <SearchIcon />
          </button>
        </form>

        <div className="nav-aside">
          <ActiveUsers />
          <Social className="nav-social" />
          <Link to="/admin/upload" className="btn btn-outline btn-sm nav-admin">Admin</Link>
        </div>

        <Link to="/movies" className="icon-btn nav-mobile-search" aria-label="Search movies">
          <SearchIcon />
        </Link>
        <button
          type="button"
          className="icon-btn nav-toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      <div id="mobile-menu" className="mobile-menu" data-open={open}>
        <nav className="container" aria-label="Mobile">
          <div className="mobile-menu-links">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : undefined)}>Home</NavLink>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="mobile-menu-foot">
            <ActiveUsers />
            <div className="nav-aside">
              <Social className="nav-social" />
              <Link to="/admin/upload" className="btn btn-outline btn-sm">Admin</Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}
