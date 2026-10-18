import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAdminSession,
  isAdminUser,
  onAdminSessionChange,
  signInAdmin,
  signOutAdmin,
} from '../lib/adminAuth'
import Seo from './Seo'

// Wrap any /admin/* page in this. Shows a sign-in form until a Supabase Auth
// user that is listed in public.admin_users signs in, then renders the page
// with a small admin nav + log out button on top.
export default function RequireAdmin({ children }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'out' | 'in'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function resolve(session) {
    if (!session) {
      setStatus('out')
      return
    }
    if (await isAdminUser()) {
      setError('')
      setStatus('in')
    } else {
      await signOutAdmin()
      setError('This account is not an admin account.')
      setStatus('out')
    }
  }

  useEffect(() => {
    let active = true
    getAdminSession().then((session) => active && resolve(session))
    // Only update local state in this callback (no Supabase calls inside it).
    const off = onAdminSessionChange((session) => {
      if (active && !session) setStatus('out')
    })
    return () => {
      active = false
      off()
    }
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { session, error: signInError } = await signInAdmin(email.trim(), password)
    if (signInError || !session) {
      setError('Wrong email or password.')
    } else {
      await resolve(session)
    }
    setBusy(false)
  }

  async function logout() {
    await signOutAdmin()
    setStatus('out')
    setEmail('')
    setPassword('')
  }

  if (status === 'loading') {
    return <Seo title="Admin login" noindex />
  }

  if (status === 'out') {
    return (
      <>
        <Seo title="Admin login" noindex />
        <div className="container" style={{ padding: '64px 24px', maxWidth: 380 }}>
          <div className="section-head"><h2>Admin login</h2></div>
          <form onSubmit={onSubmit} className="admin-login-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p className="log-line log-err">{error}</p>}
            <button className="btn" type="submit" style={{ marginTop: 8 }} disabled={busy}>
              {busy ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="admin-nav">
        <div className="container admin-nav-inner">
          <div className="admin-nav-links">
            <Link to="/admin/movie">+ Single movie</Link>
            <Link to="/admin/upload">Bulk CSV upload</Link>
            <Link to="/admin/article">Write article</Link>
            <Link to="/admin/content">Site content</Link>
            <Link to="/admin/dashboard">Channel views</Link>
          </div>
          <button className="btn btn-outline" onClick={logout}>Log out</button>
        </div>
      </div>
      {children}
    </>
  )
}
