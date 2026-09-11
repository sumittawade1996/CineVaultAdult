import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'vexn-age-verified'

// Self-declared age gate: a one-time click-through, not ID verification.
// This satisfies the baseline "prominent adult-content warning" most
// jurisdictions expect, but some (e.g. UK Online Safety Act) require
// stronger "age assurance" for sites like this one — get that reviewed by
// a lawyer before treating this as sufficient on its own.
//
// Uses the native <dialog> element so focus-trapping, top-layer stacking,
// and dialog semantics come from the browser instead of hand-rolled JS.
// Starts closed on every render (server and first client paint) and only
// opens from an effect, once localStorage says the visitor hasn't already
// confirmed — same pattern as useIsMobile, so hydration never mismatches
// and prerendered HTML never appears gated to a crawler.
export default function AgeGate() {
  const dialogRef = useRef(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') setOpen(true)
    } catch {
      // Storage blocked (private browsing, locked-down settings) — fail
      // open rather than trap a visitor who can't persist the choice.
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  function enter() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {
      // Nothing to persist — the gate will just show again next visit.
    }
    setOpen(false)
  }

  function exit() {
    window.location.href = 'https://www.google.com'
  }

  return (
    <dialog
      ref={dialogRef}
      className="age-gate"
      aria-labelledby="age-gate-title"
      onCancel={(e) => e.preventDefault()}
    >
      <div className="age-gate-brand" aria-hidden="true">VEX<span>N</span></div>
      <h2 id="age-gate-title">You must be 18 or older to enter</h2>
      <p>
        This website contains sexually explicit material intended only for adults who are at
        least 18 years old, or the age of majority in the jurisdiction from which you are
        accessing this site, whichever is greater.
      </p>
      <p>
        By clicking “I am 18 or older,” you confirm you meet this requirement and agree to our{' '}
        <Link to="/legal/terms">Terms of Service</Link> and{' '}
        <Link to="/legal/privacy">Privacy Policy</Link>.
      </p>
      <div className="age-gate-actions">
        <button type="button" className="btn" onClick={enter} autoFocus>
          I am 18 or older — Enter
        </button>
        <button type="button" className="btn btn-outline" onClick={exit}>
          I am under 18 — Exit
        </button>
      </div>
    </dialog>
  )
}
