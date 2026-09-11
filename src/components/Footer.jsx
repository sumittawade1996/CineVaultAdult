import { Link } from 'react-router-dom'
import { SITE_NAME, SOCIAL_LINKS } from '../lib/siteConfig'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <Link to="/" className="footer-brand" aria-label={`${SITE_NAME} home`}>VEX<span>N</span></Link>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/movies">Movies</Link>
          <Link to="/actors">Actors</Link>
          <Link to="/channels">Channels</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/articles">Articles</Link>
        </nav>
        <div className="footer-social">
          <a href={SOCIAL_LINKS.twitter} target="_blank" rel="noopener noreferrer" aria-label="Follow us on X (Twitter)" className="social-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7.1l-5.5-7.2L4.4 22H1.3l8.2-9.3L1 2h7.3l5 6.6L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z" />
            </svg>
            <span>Twitter</span>
          </a>
          <a href={SOCIAL_LINKS.telegram} target="_blank" rel="noopener noreferrer" aria-label="Join us on Telegram" className="social-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21.9 4.6 18.6 20.3c-.25 1.1-.9 1.38-1.83.86l-5.06-3.73-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.15L18 6.1c.4-.36-.09-.56-.62-.2L6.7 12.9l-4.98-1.56c-1.08-.34-1.1-1.08.23-1.6L20.5 3.15c.9-.33 1.68.2 1.4 1.45Z" />
            </svg>
            <span>Telegram</span>
          </a>
        </div>
        <nav className="footer-legal" aria-label="Legal">
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/dmca">DMCA</Link>
          <Link to="/legal/2257">18 U.S.C. 2257</Link>
        </nav>
        <p className="footer-note" suppressHydrationWarning>
          © {new Date().getFullYear()} {SITE_NAME}. Movie posters and artwork remain the property of their respective studios.
          All models depicted were adults, 18 years of age or older, at the time of production.
        </p>
      </div>
    </footer>
  )
}
