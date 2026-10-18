import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { isBot } from './isBot'
import { analyzeSearch } from './seoUrl'

// First-party page-view logging (plan T16). The browser sends one small JSON
// message per route change to /api/pv (netlify/edge-functions/page-view.js),
// which validates it, adds the visitor's country and a server-side bot check,
// rate-limits per IP, and writes it to the `page_views` table. No cookies and
// no personal data: path, referrer, a random per-tab session id, device class
// and campaign (utm) parameters.
//
// Crawlers and headless browsers are skipped here (see ./isBot) so the numbers
// reflect people, not the many bots that execute JavaScript.
// The table has no public SELECT policy, so the data can only be read in the
// Supabase dashboard / SQL editor, not through the site.
//
// Gated to real deployments the same way the poster Image CDN is (see
// src/lib/poster.js) so local dev and previews don't pollute the numbers.
function isTrackedHost() {
  return typeof window !== 'undefined' && /\.netlify\.app$|vexn\.org$/.test(window.location.hostname)
}

const SESSION_KEY = 'vexn-sid'

// Random id that lives only as long as the tab (sessionStorage), never sent
// as a cookie.
function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

function deviceType() {
  const w = window.innerWidth
  return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'
}

function send(payload) {
  const body = JSON.stringify(payload)
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/pv', new Blob([body], { type: 'application/json' }))) return
  } catch { /* fall through to fetch */ }
  fetch('/api/pv', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

// The previous in-app URL: document.referrer never changes during client-side
// navigation, so internal clicks need their own referrer.
let previous = null

export function useTrackPageView() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    if (!isTrackedHost() || pathname.startsWith('/admin') || isBot()) return
    const params = new URLSearchParams(search)
    // utm parameters go in their own columns; the logged path keeps only the
    // parts that make a different page (page, sort, q, ...).
    const path = (pathname + analyzeSearch(search).search).slice(0, 300)
    send({
      path,
      referrer: previous || document.referrer || null,
      session_id: sessionId(),
      device: deviceType(),
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
    })
    previous = `${window.location.origin}${path}`
  }, [pathname, search])
}

// Called by the not-found page: records the dead URL with status 404 so
// "dead-URL hits" can be counted (a separate row from the normal page view).
export function trackNotFound() {
  if (!isTrackedHost() || isBot()) return
  const path = (window.location.pathname + analyzeSearch(window.location.search).search).slice(0, 300)
  send({ path, referrer: previous || document.referrer || null, session_id: sessionId(), device: deviceType(), status_code: 404 })
}
