import { useCallback, useEffect, useState } from 'react'
import { installMode } from './installMode.js'

// Chrome and Edge fire `beforeinstallprompt` once the site can be installed. The event must be kept and
// replayed from a button of our own, so it is captured here at import time (before React renders) and
// shared by every button on the page.
let deferred = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

// Local preview only (never in a production build): /?installdemo=ios shows the iPhone variant.
const demoMode = () => (import.meta.env.DEV && new URLSearchParams(window.location.search).get('installdemo') === 'ios' ? 'ios' : null)

// mode is null on the server and on the first client render, so the prerendered HTML and the first
// client render match; it is filled in right after mount.
export function useInstall() {
  const [mode, setMode] = useState(null)
  const [hint, setHint] = useState(false)

  useEffect(() => {
    const refresh = () =>
      setMode(
        demoMode() ??
          installMode({
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            maxTouchPoints: navigator.maxTouchPoints,
            standalone: isStandalone(),
            hasPrompt: Boolean(deferred),
          })
      )
    refresh()
    listeners.add(refresh)
    return () => listeners.delete(refresh)
  }, [])

  const install = useCallback(async () => {
    if (mode === 'ios') {
      setHint(true)
      return
    }
    const event = deferred
    if (!event) return
    deferred = null // an install event can be used once
    notify()
    try {
      await event.prompt()
      await event.userChoice
    } catch {
      /* the visitor closed the dialog or the browser refused: nothing to do */
    }
  }, [mode])

  return { mode, install, hint, closeHint: () => setHint(false) }
}
