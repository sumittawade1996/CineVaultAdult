import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { usePreloadPartners } from './preload'
import { PARTNER_COLUMNS, normalizePartners } from './partnerLinks'

// Partner rows for the footer and the /partners page (plan T15). Prerendered
// pages carry the list that was current at build time. In the browser the list
// is refreshed from Supabase and kept for 10 minutes in sessionStorage, so
// partners changed in the database show up without a deploy. A failed request
// keeps what is already shown; the footer never breaks because of it.
const KEY = 'vexn.partners.v2' // v2: rows now include `details`
const TTL_MS = 10 * 60 * 1000

function readCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    if (cached && Array.isArray(cached.rows)) return cached
  } catch { /* storage blocked or corrupt: ignore */ }
  return null
}

// { partners, ready, failed }: `ready` is false only while there is nothing to
// show yet (no prerendered list, no cache, request still running), so a page
// can tell "loading" from "no partners".
export function usePartnerState() {
  const preloaded = usePreloadPartners()
  // Same first render as the server HTML (preload), so hydration matches.
  const [rows, setRows] = useState(preloaded ?? [])
  const [ready, setReady] = useState(preloaded != null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const cached = readCache()
    if (cached && Date.now() - cached.at < TTL_MS) {
      setRows(cached.rows)
      setReady(true)
      return undefined
    }
    supabase
      .from('footer_partners')
      .select(PARTNER_COLUMNS)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        setReady(true)
        if (error || !data) {
          setFailed(true)
          return
        }
        setFailed(false)
        setRows(data)
        try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), rows: data })) } catch { /* ignore */ }
      })
    return () => { cancelled = true }
  }, [])

  return { partners: normalizePartners(rows), ready, failed }
}

export default function usePartners() {
  return usePartnerState().partners
}
