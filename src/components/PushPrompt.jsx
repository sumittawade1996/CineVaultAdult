import { useEffect, useState } from 'react'
import { dismissPrompt, promptContext, pushState, subscribePush } from '../lib/push'
import { shouldPrompt } from '../lib/pushPolicy'

// A small bar at the bottom of the page on a visitor's second visit (or at once in the installed app), after the
// 18+ screen has been accepted: "Get one alert a day when new videos are added." Yes opens the browser's own
// permission question (see src/lib/pushPolicy.js); Not now hides the bar for two weeks and leaves the browser's
// permission untouched. Renders nothing on the server and on the first client render.
const SHOW_AFTER_MS = 8000

export default function PushPrompt() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let timer
    let alive = true
    pushState().then((state) => {
      if (!alive || state !== 'available') return
      // wait a few seconds so the visit counter (footer) and the age screen have settled
      timer = setTimeout(() => { if (shouldPrompt(promptContext())) setShow(true) }, SHOW_AFTER_MS)
    })
    return () => { alive = false; clearTimeout(timer) }
  }, [])

  if (!show) return null

  const yes = async () => {
    setBusy(true)
    const res = await subscribePush()
    if (!res.ok) dismissPrompt() // blocked or failed: do not ask again right away
    setShow(false)
  }
  const later = () => { dismissPrompt(); setShow(false) }

  return (
    <div className="push-prompt" role="dialog" aria-label="New-video alerts">
      <p>Get one alert a day when new videos are added. You can turn it off any time.</p>
      <div className="push-prompt-actions">
        <button type="button" className="btn btn-sm" onClick={yes} disabled={busy} autoFocus>Yes, notify me</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={later} disabled={busy}>Not now</button>
      </div>
    </div>
  )
}
