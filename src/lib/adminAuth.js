// Very simple client-side admin gate — good enough to keep casual
// visitors off /admin/*, NOT a real security boundary (the password
// lives in this bundle, so anyone who opens dev tools can read it).
// The actual data protection is Supabase's row-level security
// policies on the movies/articles tables. If you ever need this to
// be a real login, swap this for Supabase Auth instead — happy to
// wire that in.

const ADMIN_USERNAME = 'sumit'
const ADMIN_PASSWORD = 'sumit123'
const SESSION_KEY = 'cinevault-admin-authed'

export function checkAdminCredentials(username, password) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD
}

export function isAdminAuthed() {
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

export function setAdminAuthed() {
  sessionStorage.setItem(SESSION_KEY, '1')
}

export function clearAdminAuthed() {
  sessionStorage.removeItem(SESSION_KEY)
}
