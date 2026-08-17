import { Link } from 'react-router-dom'
import Seo from '../components/Seo'

export default function NotFound() {
  return (
    <>
      <Seo title="Page not found" />
      <div className="container empty-state" style={{ padding: '100px 0' }}>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>Reel missing</h2>
        <p>That page doesn't exist. <Link to="/" style={{ color: 'var(--gold)' }}>Back to home →</Link></p>
      </div>
    </>
  )
}
