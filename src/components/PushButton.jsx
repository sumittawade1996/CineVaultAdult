import { useEffect, useState } from 'react'
import { countVisit, mayOffer, pushState, subscribePush, unsubscribePush } from '../lib/push'

// "Get new-video alerts" in the footer. It stays out of the way: nothing renders until the browser can do
// web push, the visitor has been here before (or uses the installed app), and the page has mounted, so the
// prerendered HTML is the same for everyone. Permission is asked only when the button is pressed.
export default function PushButton() {
  const [state, setState] = useState(null) // null until mounted, then 'available' | 'subscribed' | 'denied' | 'unsupported'
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    countVisit()
    let alive = true
    pushState().then((s) => { if (alive) setState(mayOffer() ? s : 'unsupported') })
    return () => { alive = false }
  }, [])

  if (!state || state === 'unsupported') return null

  const turnOn = async () => {
    setBusy(true); setNote('')
    const res = await subscribePush()
    setBusy(false)
    if (res.ok) setState('subscribed')
    else if (res.reason === 'denied') { setState('denied'); setNote('Notifications are blocked for this site in your browser settings.') }
    else setNote('Could not turn alerts on. Please try again later.')
  }
  const turnOff = async () => {
    setBusy(true); setNote('')
    await unsubscribePush()
    setBusy(false)
    setState('available')
  }

  return (
    <div className="push-alerts">
      {state === 'subscribed' ? (
        <>
          <span className="push-alerts-text">New-video alerts are on.</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={turnOff} disabled={busy}>Turn off</button>
        </>
      ) : state === 'denied' ? (
        <span className="push-alerts-text">Alerts are blocked in your browser settings.</span>
      ) : (
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={turnOn} disabled={busy} title="One notification a day when new videos are added. No titles are shown on your lock screen.">
            Get new-video alerts
          </button>
          <span className="push-alerts-text">One notification a day when new videos are added.</span>
        </>
      )}
      {note && <span className="push-alerts-text" role="status">{note}</span>}
    </div>
  )
}
