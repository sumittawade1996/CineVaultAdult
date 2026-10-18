import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useInstall } from '../lib/useInstall'

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v10m0 0-4-4m4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share" role="img">
      <path d="M12 15V4m0 0L8 8m4-4 4 4" />
      <path d="M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7" />
    </svg>
  )
}

// The two steps an iPhone or iPad visitor has to do themselves.
function InstallHint({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="install-hint" role="dialog" aria-label="Add VEXN to your Home Screen">
      <p className="install-hint-title">Add VEXN to your Home Screen</p>
      <ol>
        <li>Tap the Share button <ShareIcon /> in your browser.</li>
        <li>Choose <strong>Add to Home Screen</strong>.</li>
      </ol>
      <button type="button" className="btn btn-sm" onClick={onClose} autoFocus>Got it</button>
    </div>
  )
}

// variant "nav"  -> in the desktop header (icon only on narrower screens)
// variant "menu" -> full-width row inside the phone menu
// Renders nothing unless the visitor can install the site (see src/lib/installMode.js).
export default function InstallButton({ variant = 'nav' }) {
  const { mode, install, hint, closeHint } = useInstall()
  if (!mode) return null
  const label = mode === 'ios' ? 'Add to Home Screen' : 'Install app'
  return (
    <>
      <button
        type="button"
        className={`btn btn-outline btn-sm install-btn install-btn--${variant}`}
        onClick={install}
        title="Open VEXN like an app, one tap from your home screen"
        aria-label={label}
      >
        <DownloadIcon />
        <span className="install-btn-text">{label}</span>
      </button>
      {/* on the page body, so it stays visible when the phone menu around the button closes */}
      {hint && createPortal(<InstallHint onClose={closeHint} />, document.body)}
    </>
  )
}
