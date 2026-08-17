import { useState } from 'react'
import { Link } from 'react-router-dom'
import { checkAdminCredentials, isAdminAuthed, setAdminAuthed, clearAdminAuthed } from '../lib/adminAuth'
import Seo from './Seo'

// Wrap any /admin/* page in this. Shows a login form until the
// hardcoded username/password is entered, then renders the page with
// a small admin nav + logout link on top.
export default function RequireAdmin({ children }) {
  const [authed, setAuthed] = useState(isAdminAuthed())
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function onSubmit(e) {
    e.preventDefault()
    if (checkAdminCredentials(username, password)) {
      setAdminAuthed()
      setAuthed(true)
      setError('')
    } else {
      setError('Wrong username or password.')
    }
  }

  function logout() {
    clearAdminAuthed()
    setAuthed(false)
    setUsername('')
    setPassword('')
  }

  if (!authed) {
    return (
      <>
        <Seo title="Admin login" noindex />
        <div className="container" style={{ padding: '64px 24px', maxWidth: 380 }}>
          <div className="section-head"><h2>Admin login</h2></div>
          <form onSubmit={onSubmit} className="admin-login-form">
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error && <p className="log-line log-err">{error}</p>}
            <button className="btn" type="submit" style={{ marginTop: 8 }}>
              Log in
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
          </div>
          <button className="btn btn-outline" onClick={logout}>Log out</button>
        </div>
      </div>
      {children}
    </>
  )
}
