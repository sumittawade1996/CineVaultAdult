import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabase'

// Minimal first-party pageview logging into Supabase (see the
// `page_views` table/migration) — chosen over a third-party tool like
// Plausible or Umami because those require signing up for a hosted
// account, which isn't something that can be done on the site owner's
// behalf. No cookies, no personal data: just path, referrer, and time.
// The table has no public SELECT policy, so this data can only be read
// from the Supabase dashboard/SQL editor, not through the site itself.
//
// Gated to real deployments the same way the poster Image CDN is (see
// src/lib/poster.js) so local dev and previews don't pollute the numbers.
function isTrackedHost() {
  return typeof window !== 'undefined' && /\.netlify\.app$|vexn\.org$/.test(window.location.hostname)
}

export function useTrackPageView() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    if (!isTrackedHost() || pathname.startsWith('/admin')) return
    supabase
      .from('page_views')
      .insert({ path: pathname + search, referrer: document.referrer || null })
      .then(({ error }) => { if (error) console.warn('[analytics]', error.message) })
  }, [pathname, search])
}
